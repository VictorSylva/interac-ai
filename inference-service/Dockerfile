FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required by OpenCV and gRPC
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgthread-2.0-0 \
    libgl1 \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . /app

# Compile protobuf schemas into Python packages inside the container
RUN python compile_proto.py

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 50051

CMD ["python", "server.py"]
