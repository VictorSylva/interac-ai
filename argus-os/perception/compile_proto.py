import os
import subprocess
import sys

def compile():
    print("Compiling proto files for Camera Service...")
    try:
        import grpc_tools.protoc
    except ImportError:
        print("grpcio-tools not installed on host. Bindings will be generated inside Docker container on build.")
        return

    # Check for proto file in sibling folder
    sibling_proto_path = "../../inference-service/proto"
    local_proto_path = "proto"

    if os.path.exists(os.path.join(sibling_proto_path, "inference.proto")):
        proto_path = sibling_proto_path
    else:
        proto_path = local_proto_path

    proto_file = os.path.join(proto_path, "inference.proto")
    output_path = "hal/providers/grpc_bindings"

    os.makedirs(output_path, exist_ok=True)
    os.makedirs(local_proto_path, exist_ok=True)

    # Copy proto locally if using sibling folder to ensure self-contained context
    if proto_path == sibling_proto_path:
        import shutil
        shutil.copy2(proto_file, os.path.join(local_proto_path, "inference.proto"))
        proto_path = local_proto_path
        proto_file = os.path.join(proto_path, "inference.proto")

    cmd = [
        sys.executable,
        "-m", "grpc_tools.protoc",
        f"-I{proto_path}",
        f"--python_out={output_path}",
        f"--grpc_python_out={output_path}",
        proto_file
    ]
    
    print("Running command:", " ".join(cmd))
    subprocess.check_call(cmd)
    
    # Touch __init__.py inside grpc_bindings folder to make it a package
    init_file = os.path.join(output_path, "__init__.py")
    with open(init_file, "w") as f:
        f.write("# Generated package for proto files\n")
        
    print("Proto compilation completed successfully.")

if __name__ == "__main__":
    compile()
