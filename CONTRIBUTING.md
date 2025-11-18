# Contributing to Parakeet TDT

Thank you for your interest in contributing to Parakeet TDT! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Parakeet-TDT.git
   cd Parakeet\ TDT
   ```

3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Set up your development environment**:
   - See [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed setup instructions

## Development Workflow

### Backend Changes
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Changes
```bash
cd frontend
npm install
npm run dev
```

## Code Style

### Python
- Follow PEP 8 guidelines
- Use 4 spaces for indentation
- Use meaningful variable names
- Add docstrings to functions

### TypeScript/React
- Use ESLint configuration provided
- 2 spaces for indentation
- Use descriptive component names
- Add comments for complex logic

## Commit Messages

Use clear, descriptive commit messages:

```bash
# Good
git commit -m "Add speaker diarization with pyannote.audio"

# Bad
git commit -m "Fix stuff"
```

### Format
```
<type>: <subject>

<body - optional>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation updates
- `perf`: Performance improvements
- `test`: Test additions/changes

## Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Test your changes** thoroughly:
   - Test with different audio inputs
   - Test multi-user scenarios if applicable
   - Test edge cases

3. **Create a descriptive PR**:
   - Explain what problem you're solving
   - Describe your solution
   - Include any relevant issue numbers

4. **Wait for review** - maintainers will review and provide feedback

## Testing

### Backend
```bash
cd backend
python -m pytest
```

### Frontend
```bash
cd frontend
npm test
```

## Known Issues & Limitations

See [CLAUDE.md](./CLAUDE.md) for:
- Current limitations
- Speaker diarization accuracy notes
- Performance considerations
- Multi-user capacity

## Questions or Need Help?

- Check existing issues: https://github.com/YOUR_USERNAME/Parakeet-TDT/issues
- Create a new issue for bugs or feature requests
- Use discussions for questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
