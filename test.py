import os
import requests
import jwt
from dotenv import load_dotenv

# --------------------------------
# LOAD ENV
# --------------------------------

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    raise Exception("JWT_SECRET not found in .env")

# --------------------------------
# CONFIG
# --------------------------------

# BASE_URL = "http://127.0.0.1:8081"
BASE_URL = "https://ansonsajugeorge.online/wms/api"

JOB_ID = "c7b93f8c-8186-4c0a-b009-3cc7bbce0269"

# --------------------------------
# GENERATE TOKEN
# --------------------------------

payload = {
    "user_id": 1,
    "email": "debug@test.com",
    "role": "admin"
}

token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

headers = {
    "Authorization": f"Bearer {token}"
}

print("\nGenerated JWT:")
print(token[:40] + "...")

# --------------------------------
# TEST STATUS
# --------------------------------

print("\nChecking job status...")

status_res = requests.get(
    f"{BASE_URL}/status/{JOB_ID}"
)

print("Status code:", status_res.status_code)
print("Response:", status_res.text)

# --------------------------------
# TEST DOWNLOAD
# --------------------------------

print("\nTesting download...")

download_res = requests.get(
    f"{BASE_URL}/download/{JOB_ID}",
    headers=headers,
    stream=True
)

print("Status code:", download_res.status_code)

if download_res.status_code != 200:
    print("Download failed:")
    print(download_res.text)
    exit()

filename = "debug_download.mp4"

with open(filename, "wb") as f:
    for chunk in download_res.iter_content(chunk_size=8192):
        if chunk:
            f.write(chunk)

print("\nDownload successful!")
print("Saved as:", filename)

size = os.path.getsize(filename) / (1024 * 1024)

print(f"File size: {size:.2f} MB")