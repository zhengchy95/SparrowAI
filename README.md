# 🦆 SparrowAI

> A modern, lightning-fast desktop AI chat application built with Tauri, React, and OpenVINO Model Server (OVMS)

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/DavidOzc/SparrowAI/blob/main/LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://reactjs.org)
[![Rust](https://img.shields.io/badge/Rust-2021-000000?logo=rust)](https://www.rust-lang.org)

## ✨ Features

### 🤖 **AI-Powered Conversations**
- Real-time streaming chat with AI models
- Conversation history and session management
- Customizable system prompts and parameters
- Tokens per second performance metrics

### 🔍 **Model Management**
- Browse and search Hugging Face Model Hub
- Download OpenVINO-optimized models
- Local model storage and organization
- Easy model loading and switching

### ⚡ **High Performance**
- Powered by Intel OpenVINO for optimized inference
- Local processing with OVMS (OpenVINO Model Server)
- Hardware acceleration (CPU/GPU support)
- Efficient memory management

### 🎨 **Modern Interface**
- Material-UI design system
- Dark/Light theme support
- Responsive layout
- Smooth animations and transitions

### 🔧 **Developer-Friendly**
- Built with Tauri for native performance
- Cross-platform compatibility (Windows, macOS, Linux)
- Modern web technologies (React, Vite)
- Type-safe Rust backend

## 📸 Screenshots

*Beautiful, intuitive interface for seamless AI interactions*

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18+ recommended)
- **Rust** (latest stable)
- **pnpm** package manager
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/DavidOzc/SparrowAI.git
   cd SparrowAI
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Run in development mode**
   ```bash
   pnpm tauri dev
   ```

4. **Build for production**
   ```bash
   pnpm tauri build
   ```

## 🏗️ Architecture

SparrowAI follows a modern hybrid architecture:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │◄──►│   Tauri Bridge   │◄──►│   Rust Backend  │
│                 │    │                  │    │                 │
│ • Chat UI       │    │ • IPC Commands   │    │ • OVMS Manager  │
│ • Model Browser │    │ • Event System   │    │ • HF Integration│
│ • Settings      │    │ • File System    │    │ • Chat Sessions │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                ▲
                                │
                    ┌──────────────────┐
                    │ OpenVINO Model   │
                    │ Server (OVMS)    │
                    │                  │
                    │ • Model Serving  │
                    │ • Inference API  │
                    │ • GPU Acceleration│
                    └──────────────────┘
```

## 🧠 Core Components

### Frontend (`src/`)
- **App.jsx** - Main application with theming and routing
- **ChatPage.jsx** - Real-time chat interface with streaming
- **ModelsPage.jsx** - Model browser and management
- **Sidebar.jsx** - Navigation and session management
- **useAppStore.js** - Zustand state management

### Backend (`src-tauri/src/`)
- **lib.rs** - Main Tauri application entry point
- **ovms.rs** - OpenVINO Model Server integration
- **huggingface.rs** - Hugging Face Hub API client
- **chat_sessions.rs** - Conversation persistence
- **tests.rs** - Development and testing utilities

## 🎯 Usage

### Getting Started
1. **Initial Setup**: Launch SparrowAI and follow the setup wizard
2. **Download OVMS**: The app will automatically download OpenVINO Model Server
3. **Browse Models**: Navigate to the Models tab to search Hugging Face
4. **Download a Model**: Choose an OpenVINO-compatible model (look for "OpenVINO" organization)
5. **Start Chatting**: Load your model and begin conversations

### Model Recommendations
- **OpenVINO/Phi-3.5-mini-instruct-int4-ov** - Lightweight and fast
- **OpenVINO/Meta-Llama-3-8B-Instruct-int4-ov** - Balanced performance
- **OpenVINO/Qwen2.5-7B-Instruct-int4-ov** - Multilingual support

### Advanced Features
- **Custom System Prompts**: Configure AI behavior in settings
- **Parameter Tuning**: Adjust temperature, top-p, and token limits
- **Session Management**: Organize conversations by topic
- **Performance Monitoring**: Track inference speed and efficiency

## ⚙️ Configuration

### Settings Location
- **Windows**: `%USERPROFILE%\.sparrow\`
- **macOS**: `~/.sparrow/`
- **Linux**: `~/.sparrow/`

### Directory Structure
```
.sparrow/
├── models/           # Downloaded AI models
├── ovms/            # OpenVINO Model Server
├── chat_sessions.json # Conversation history
└── config.json     # Application settings
```

## 🔧 Development

### Project Structure
```
SparrowAI/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/             # Custom React hooks
│   └── store/             # State management
├── src-tauri/             # Rust backend
│   ├── src/               # Rust source code
│   ├── icons/             # App icons
│   └── Cargo.toml         # Rust dependencies
├── public/                # Static assets
├── package.json           # Node.js dependencies
└── vite.config.js         # Build configuration
```

### Available Scripts
```bash
pnpm dev          # Start development server
pnpm build        # Build frontend for production
pnpm tauri dev    # Run Tauri development mode
pnpm tauri build  # Build complete application
```

### Key Technologies
- **Frontend**: React 18, Material-UI, Zustand
- **Backend**: Rust, Tauri, Tokio
- **AI**: OpenVINO Model Server, OpenAI API compatible
- **Build**: Vite, Tauri CLI

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines
- Follow Rust formatting conventions (`cargo fmt`)
- Ensure tests pass (`cargo test`)
- Update documentation for new features
- Maintain TypeScript compatibility in React components

## 📋 Roadmap

### 🚧 In Development
- [ ] Multi-model conversation support
- [ ] RAG (Retrieval Augmented Generation) integration
- [ ] Plugin system for custom integrations
- [ ] Cloud sync for settings and sessions

### 🎯 Future Plans
- [ ] Voice input/output capabilities
- [ ] Image generation support
- [ ] Collaborative chat features
- [ ] Advanced model fine-tuning tools

## 🔍 Troubleshooting

### Common Issues

**OVMS fails to start**
- Ensure Windows Defender allows the application
- Check that required ports (8000, 8001) are available
- Verify sufficient disk space for model downloads

**Model download stuck**
- Check internet connection
- Verify Hugging Face is accessible
- Try downloading a smaller model first

**Chat responses are slow**
- Monitor CPU/GPU usage
- Try int4 quantized models for better performance
- Adjust max_tokens setting in preferences

### Getting Help
- 📖 Check the [documentation](https://github.com/DavidOzc/SparrowAI/wiki)
- 🐛 Report bugs via [GitHub Issues](https://github.com/DavidOzc/SparrowAI/issues)
- 💬 Join our [Discord community](https://discord.gg/sparrowai)

## 📊 Performance

SparrowAI is optimized for performance:

- **Memory Usage**: ~200MB base + model size
- **CPU Utilization**: Efficient with OpenVINO optimizations
- **Startup Time**: < 3 seconds on modern hardware
- **Inference Speed**: Varies by model and hardware (typically 10-50+ tokens/sec)

## 🔒 Privacy & Security

- **Local-First**: All conversations stay on your device
- **No Telemetry**: No data collection or tracking
- **Open Source**: Full transparency in code and behavior
- **Secure**: Tauri's security model protects against common vulnerabilities

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenVINO Team** for the incredible optimization toolkit
- **Tauri Team** for the excellent cross-platform framework
- **Hugging Face** for democratizing access to AI models
- **Material-UI** for the beautiful component library

---

<div align="center">

**Made with ❤️ by [David Øzc](https://github.com/DavidOzc)**

[⭐ Star this project](https://github.com/DavidOzc/SparrowAI) • [🐛 Report Bug](https://github.com/DavidOzc/SparrowAI/issues) • [✨ Request Feature](https://github.com/DavidOzc/SparrowAI/issues)

</div>