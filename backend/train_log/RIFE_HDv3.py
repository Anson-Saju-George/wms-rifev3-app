# train_log/RIFE_HDv3.py
# Patched to be compatible with IFNet_HDv3.forward(imgs, scale_list=..., training=...)
# - Passes imgs (I0+I1) only, not concatenated with GT
# - Uses scale_list kwarg (not scale)
# - Defines loss_cons before use
# - Keeps inference API unchanged
import torch
import torch.nn as nn
import numpy as np
from torch.optim import AdamW
import torch.optim as optim
import itertools
from model.warplayer import warp
from torch.nn.parallel import DistributedDataParallel as DDP
# NOTE: IFNet_HDv3 should exist in train_log/ as provided
from train_log.IFNet_HDv3 import *
import torch.nn.functional as F
from model.loss import *

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
class Model:
    def __init__(self, local_rank=-1):
        # instantiate IFNet (v3)
        self.flownet = IFNet()
        self.device()
        # small lr here - RIFE original often uses separate optim setup
        self.optimG = AdamW(self.flownet.parameters(), lr=1e-6, weight_decay=1e-4)
        self.epe = EPE()
        # self.vgg = VGGPerceptualLoss().to(device)  # optional, commented out in OG
        self.sobel = SOBEL()
        if local_rank != -1:
            self.flownet = DDP(self.flownet, device_ids=[local_rank], output_device=local_rank)

    def train(self):
        self.flownet.train()

    def eval(self):
        self.flownet.eval()

    def device(self):
        self.flownet.to(device)

    def load_model(self, path, rank=0):
        def convert(param):
            if rank == -1:
                return {
                    k.replace("module.", ""): v
                    for k, v in param.items()
                    if "module." in k
                }
            else:
                return param
        if rank <= 0:
            if torch.cuda.is_available():
                self.flownet.load_state_dict(convert(torch.load('{}/flownet.pkl'.format(path))))
            else:
                self.flownet.load_state_dict(convert(torch.load('{}/flownet.pkl'.format(path), map_location ='cpu')))
        
    def save_model(self, path, rank=0):
        if rank == 0:
            torch.save(self.flownet.state_dict(),'{}/flownet.pkl'.format(path))

    def inference(self, img0, img1, scale=1.0):
        """
        img0, img1: tensors with shape [B,3,H,W] in [0,1] float
        scale: relative scale factor for multi-scale processing (1.0 => default)
        returns merged[2] (the finest-scale interpolated frame)
        """
        imgs = torch.cat((img0, img1), 1)    # [B,6,H,W]
        scale_list = [4/scale, 2/scale, 1/scale]
        # call IFNet with imgs and scale_list (v3 expects scale_list kwarg)
        flow, mask, merged = self.flownet(imgs, scale_list=scale_list)
        return merged[2]
    
    def update(self, imgs, gt, learning_rate=0, mul=1, training=True, flow_gt=None):
        """
        imgs: tensor [B,6,H,W]  (I0 | I1)
        gt:   tensor [B,3,H,W]  (ground truth middle frame)
        """
        # set learning rate for optimizer
        for param_group in self.optimG.param_groups:
            param_group['lr'] = learning_rate

        img0 = imgs[:, :3]
        img1 = imgs[:, 3:]
        if training:
            self.train()
        else:
            self.eval()

        # Use scale_list (v3 IFNet expects scale_list kwarg)
        scale_list = [4, 2, 1]

        # --- IMPORTANT: pass imgs (I0+I1) only, not concat(imgs, gt) ---
        flow, mask, merged = self.flownet(imgs, scale_list=scale_list, training=training)

        # reconstruction loss (pixel L1)
        loss_l1 = (merged[2] - gt).abs().mean()

        # smoothness or regularization on flow
        loss_smooth = self.sobel(flow[2], flow[2]*0).mean()

        # define consistency loss (minimal safe choice)
        loss_cons = loss_l1

        # optimization step
        if training:
            self.optimG.zero_grad()
            loss_G = loss_cons + 0.1 * loss_smooth
            loss_G.backward()
            self.optimG.step()
        else:
            # if not training, we might want to keep teacher flow for eval/visualization
            flow_teacher = flow[2]

        # return interpolated frame and info dict
        return merged[2], {
            'mask': mask,
            'flow': flow[2][:, :2],
            'loss_l1': loss_l1,
            'loss_cons': loss_cons,
            'loss_smooth': loss_smooth,
        }
