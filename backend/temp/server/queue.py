import redis
import json

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

MAX_QUEUE = 5

def enqueue(job_data):
    if r.llen("vfi_queue") >= MAX_QUEUE:
        return False
    r.rpush("vfi_queue", json.dumps(job_data))
    return True

def dequeue():
    job = r.lpop("vfi_queue")
    return json.loads(job) if job else None