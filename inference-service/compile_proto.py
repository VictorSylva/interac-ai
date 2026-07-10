import os
import subprocess
import sys

def compile():
    print("Compiling proto files...")
    try:
        import grpc_tools.protoc
    except ImportError:
        print("grpcio-tools not installed. Please run: pip install grpcio-tools")
        sys.exit(1)

    proto_path = "proto"
    proto_file = os.path.join(proto_path, "inference.proto")
    output_path = "proto"

    # Make output directory if not exists
    os.makedirs(output_path, exist_ok=True)

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
    
    # Touch __init__.py inside proto folder to make it a package
    init_file = os.path.join(output_path, "__init__.py")
    with open(init_file, "w") as f:
        f.write("# Generated package for proto files\n")
        
    print("Proto compilation completed successfully.")

if __name__ == "__main__":
    compile()
