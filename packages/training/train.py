import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import os

# Set random seeds for reproducibility
np.random.seed(42)
torch.manual_seed(42)

# Replicate the PulseGenerator math in Python
class PulseGeneratorPython:
    def __init__(self):
        self.step = 0
        self.signal_b_state = 0.5
        self.signal_d_state = 0.3

    def generate(self):
        self.step += 1
        circadian_rad = (self.step * 2 * np.pi) / 86400
        ultradian_rad = (self.step * 2 * np.pi) / 5400

        # Signal A
        base_a = 0.5 + 0.2 * np.sin(circadian_rad) + 0.1 * np.cos(ultradian_rad)
        noise_a = np.random.normal(0, 0.02)
        signal_a = base_a + noise_a

        # Signal B
        reversion_speed = 0.05
        mean_b = 0.4
        walk_b = np.random.normal(0, 0.03)
        if np.random.random() < 0.01:
            walk_b += 0.4
        self.signal_b_state = self.signal_b_state + reversion_speed * (mean_b - self.signal_b_state) + walk_b
        signal_b = self.signal_b_state

        # Signal C
        circadian_c = 0.4 + 0.25 * np.sin(circadian_rad + np.pi / 3)
        noise_c = np.random.normal(0, 0.04)
        b_influence = max(0, signal_b - 0.6) * 0.2
        signal_c = circadian_c - 0.2 * (signal_a - 0.5) + b_influence + noise_c

        # Signal D
        mean_d = 0.3
        walk_d = np.random.normal(0, 0.02)
        if np.random.random() < 0.005:
            walk_d += 0.35
        stress_drag = -0.05 * (signal_c - 0.6) if signal_c > 0.6 else 0
        self.signal_d_state = self.signal_d_state + 0.02 * (mean_d - self.signal_d_state) + walk_d + stress_drag
        signal_d = self.signal_d_state

        signal_a = np.clip(signal_a, 0.0, 1.0)
        signal_b = np.clip(signal_b, 0.0, 1.0)
        signal_c = np.clip(signal_c, 0.0, 1.0)
        signal_d = np.clip(signal_d, 0.0, 1.0)

        return [signal_a, signal_b, signal_c, signal_d]

# GRU Model definition
class PredictorGRU(nn.Module):
    def __init__(self, input_size=4, hidden_size=16, num_layers=1, output_size=4):
        super(PredictorGRU, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.gru = nn.GRU(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.gru(x, h0)
        out = self.fc(out[:, -1, :])
        return out

def main():
    print("Generating dataset...")
    generator = PulseGeneratorPython()
    dataset_size = 200000
    data = []
    for _ in range(dataset_size):
        data.append(generator.generate())
    
    data = np.array(data, dtype=np.float32)

    # Create sliding windows of size 32
    window_size = 32
    X = []
    Y = []
    for i in range(len(data) - window_size):
        X.append(data[i : i + window_size])
        Y.append(data[i + window_size])

    X = np.array(X)
    Y = np.array(Y)

    # Train/Val split
    split = int(len(X) * 0.9)
    X_train, X_val = X[:split], X[split:]
    Y_train, Y_val = Y[:split], Y[split:]

    # Convert to PyTorch tensors
    X_train_tensor = torch.tensor(X_train)
    Y_train_tensor = torch.tensor(Y_train)
    X_val_tensor = torch.tensor(X_val)
    Y_val_tensor = torch.tensor(Y_val)

    # Model, loss, optimizer
    model = PredictorGRU()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.005)

    batch_size = 128
    epochs = 5

    print("Training the GRU model...")
    for epoch in range(epochs):
        model.train()
        permutation = torch.randperm(X_train_tensor.size(0))
        epoch_loss = 0.0
        
        for i in range(0, X_train_tensor.size(0), batch_size):
            indices = permutation[i : i + batch_size]
            batch_x, batch_y = X_train_tensor[indices], Y_train_tensor[indices]

            optimizer.zero_grad()
            predictions = model(batch_x)
            loss = criterion(predictions, batch_y)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item() * batch_x.size(0)

        epoch_loss /= X_train_tensor.size(0)
        
        # Validation loss
        model.eval()
        with torch.no_grad():
            val_preds = model(X_val_tensor)
            val_loss = criterion(val_preds, Y_val_tensor).item()

        print(f"Epoch {epoch+1}/{epochs} | Train Loss: {epoch_loss:.6f} | Val Loss: {val_loss:.6f}")

    # Export to ONNX
    print("Exporting model to ONNX...")
    models_dir = "../../models"
    os.makedirs(models_dir, exist_ok=True)
    onnx_path = os.path.join(models_dir, "predictive_model.onnx")
    
    # Example input representing dynamic batch size
    dummy_input = torch.randn(1, window_size, 4)
    
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}}
    )
    print(f"Model successfully exported to: {os.path.abspath(onnx_path)}")

if __name__ == "__main__":
    main()
