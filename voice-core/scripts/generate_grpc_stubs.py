#!/usr/bin/env python3
"""
Generate gRPC Python stubs from proto file.
"""

import subprocess
import sys
from pathlib import Path

# Get project root
project_root = Path(__file__).parent.parent
proto_dir = project_root.parent / "proto"
output_dir = project_root / "src" / "grpc"

# Ensure output directory exists
output_dir.mkdir(parents=True, exist_ok=True)

# Generate Python stubs
proto_file = proto_dir / "voice_core.proto"

if not proto_file.exists():
    print(f"Error: Proto file not found at {proto_file}")
    sys.exit(1)

print(f"Generating gRPC stubs from {proto_file}...")

try:
    subprocess.run(
        [
            sys.executable, "-m", "grpc_tools.protoc",
            f"--proto_path={proto_dir}",
            f"--python_out={output_dir}",
            f"--grpc_python_out={output_dir}",
            str(proto_file),
        ],
        check=True,
    )
    print(f"✓ Generated stubs in {output_dir}")
except subprocess.CalledProcessError as e:
    print(f"Error generating stubs: {e}")
    sys.exit(1)
