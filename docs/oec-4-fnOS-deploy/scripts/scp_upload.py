#!/usr/bin/env python3
"""
SCP Upload Script - Upload Readest config to oec-4-fnOS
Uses paramiko + SFTP to upload files with forced overwrite.

Usage:
    python scp_upload.py --csv /path/to/password.csv

The CSV file should have columns: IP地址,用户名,密码,SSH端口
"""

import argparse
import os
import sys
import csv
import paramiko
from pathlib import Path

LOCAL_CONFIG_DIR = Path(__file__).parent.parent / "config"
REMOTE_BASE_DIR = "/vol1/docker/mycontainers/readest"


def load_credentials(csv_path):
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            return {
                'ip': row['IP地址'],
                'username': row['用户名'],
                'password': row['密码'],
                'port': int(row['SSH端口']),
            }


def ensure_remote_dir(sftp, remote_dir):
    """Recursively create remote directory if it doesn't exist."""
    dirs_to_create = []
    current = remote_dir
    while current and current != '/':
        try:
            sftp.stat(current)
            break
        except FileNotFoundError:
            dirs_to_create.append(current)
            current = os.path.dirname(current).replace('\\', '/')
    for d in reversed(dirs_to_create):
        try:
            sftp.mkdir(d)
            print(f"  [DIR] Created: {d}")
        except IOError:
            pass  # Already exists


def upload_directory(local_dir, remote_dir, csv_path):
    creds = load_credentials(csv_path)
    print(f"Connecting to {creds['ip']}:{creds['port']}...")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        hostname=creds['ip'],
        port=creds['port'],
        username=creds['username'],
        password=creds['password'],
        timeout=30
    )

    sftp = ssh.open_sftp()

    # Ensure base remote directory exists
    ensure_remote_dir(sftp, remote_dir)

    upload_count = 0
    for root, dirs, files in os.walk(local_dir):
        rel_path = os.path.relpath(root, local_dir)
        if rel_path == '.':
            remote_current = remote_dir
        else:
            remote_current = remote_dir + "/" + rel_path.replace('\\', '/')

        ensure_remote_dir(sftp, remote_current)

        for fname in files:
            local_file = os.path.join(root, fname)
            remote_file = remote_current + "/" + fname

            try:
                # Force overwrite: remove existing file first
                try:
                    sftp.stat(remote_file)
                    sftp.remove(remote_file)
                except FileNotFoundError:
                    pass

                sftp.put(local_file, remote_file)
                upload_count += 1
                print(f"  [FILE] {fname} -> {remote_file}")
            except Exception as e:
                print(f"  [ERROR] {fname}: {e}")

    sftp.close()
    ssh.close()
    print(f"\nUpload complete: {upload_count} files uploaded to {remote_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload Readest config to oec-4-fnOS via SCP")
    parser.add_argument("--csv", required=True, help="Path to password.csv with SSH credentials")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)

    local_config = LOCAL_CONFIG_DIR
    if not local_config.exists():
        print(f"Error: Config directory not found: {local_config}")
        sys.exit(1)

    upload_directory(local_config, REMOTE_BASE_DIR, csv_path)
