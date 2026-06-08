# Obsidian Editor Width

Control and customize the width of your editor in Obsidian with precision. This plugin adds an intuitive width control interface directly in your markdown tabs.

## Features

- 📏 **Adjustable Editor Width** - Slider control to set custom width for your editor (300px - 1600px)
- 🔒 **Per-File Width Locking** - Set different widths for individual files or use a global default
- 🎯 **Visual Width Guides** - Vertical guides show exactly where your editor boundaries are
- 🎨 **Customizable Colors** - Change the icon and guide colors to match your theme
- ⌨️ **Cursor Preservation** - Optionally restore cursor position when closing the width control popup
- 🔄 **Live Updates** - Real-time width adjustment with immediate visual feedback

## Usage

### Quick Start

1. Open any Markdown file in Obsidian
2. Look for the **width icon** (↔) in the markdown tab header
3. Click the icon to open the width adjustment popup
4. Use the slider to adjust your desired editor width
5. Click the **lock icon** to save this width for the current file

### Width Modes

- **Global (unlock icon)** - Width applies to all files by default
- **Local (lock icon)** - Width is saved only for this specific file

### Settings

Access plugin settings via **Settings → Editor Width**:

- **Enable Line Width** - Toggle the width control feature
- **Line Width Color** - Customize the color of width control icons
- **Restore cursor on close** - Automatically restore cursor position when closing the popup

## Installation

1. Open Obsidian Settings → Community plugins
2. Search for "**Editor Width**"
3. Click **Install**
4. Enable the plugin in your plugin list

## Development

### Environment Setup

Create a `.env` file with your vault paths:

```env
TEST_VAULT=C:\path\to\test\vault
REAL_VAULT=C:\path\to\production\vault
```

**Two development modes:**

1. **In-place development** (inside vault):
   - Develop directly in `.obsidian/plugins/your-plugin`
   - Run `yarn dev` - builds automatically to current location

2. **External development** (outside vault):
   - Develop anywhere on your system
   - Configure `.env` with vault paths
   - Run `yarn dev` - builds to TEST_VAULT
   - Run `yarn real` - builds to REAL_VAULT

## Commands

### Development

```bash
yarn start          # Install dependencies + start dev
yarn dev            # Development build (watch mode)
yarn build          # Production build
yarn real           # Build + install to real vault
```

### Git Automation

```bash
yarn acp            # Add, commit, push
yarn bacp           # Build + add, commit, push
```

### Version & Release

```bash
yarn v              # Update version (prompts for type)
yarn r              # Create GitHub release
```

### Code Quality

```bash
yarn lint           # ESLint check
yarn lint:fix       # ESLint fix
yarn prettier       # Prettier check
yarn prettier:fix   # Prettier format all
```

### Help

```bash
yarn h              # Full help documentation
```

## VSCode Tasks

Quick access via `Ctrl+Shift+P` → "Run Task":

- **Build** - Production build
- **Lint** / **Lint: Fix** - ESLint check/fix
- **Prettier: Check** / **Prettier: Fix** - Format check/fix
- **Obsidian Inject** - Re-inject configuration (with confirmation)
- **Obsidian Inject (no confirm)** - Re-inject without confirmation
- **Cleanup: Lint + Prettier + Build** - Full cleanup sequence

💡 **Tip**: Use `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (Mac) for the default Build task.

## Updating via obsidian-plugin-config

This plugin can be automatically updated with the latest scripts and configurations:

### Global Installation (one time)

```bash
npm install -g obsidian-plugin-config
```

### Update the Plugin

```bash
cd your-plugin
obsidian-inject
```

### Update Options

```bash
# With confirmation (default)
obsidian-inject

# Without confirmation
obsidian-inject --yes

# Interactive mode (choose what to inject)
obsidian-inject --interactive

# Use preset
obsidian-inject --preset=minimal

# With SASS support
obsidian-inject --sass

# Verification only (no changes)
obsidian-inject --dry-run
```

### What Gets Updated

- ✅ Local scripts (esbuild.config.ts, acp.ts, utils.ts, etc.)
- ✅ package.json (scripts, dependencies)
- ✅ tsconfig.json
- ✅ eslint.config.mts
- ✅ Config files (.editorconfig, .prettierrc, .npmrc, .env)
- ✅ VSCode settings and tasks
- ✅ GitHub Actions workflows

## SASS Support (Optional)

To add SASS/SCSS support:

```bash
obsidian-inject --sass
```

**What SASS injection adds:**

- ✅ `esbuild-sass-plugin` dependency
- ✅ Automatic compilation of `.scss` files
- ✅ Priority detection: `src/styles.scss` > `src/styles.css` > `styles.css`
- ✅ Automatic cleanup of generated CSS

**Usage:**

1. Create `src/styles.scss` instead of `styles.css`
2. Use SASS variables, mixins and features
3. Build automatically compiles to CSS

## Architecture

### Self-Contained Design

All development tools are integrated locally in `./scripts/`:

- `esbuild.config.ts` - Build configuration with SASS detection
- `acp.ts` - Git automation (add, commit, push)
- `update-version.ts` - Version management
- `release.ts` - GitHub release automation
- `utils.ts` - Shared utility functions
- `help.ts` - Help documentation

**No external dependencies required** - the plugin is 100% standalone after injection.

### Traceability

`.injection-info.json` tracks:
- Injector version used
- Injection date
- Injector name

This allows checking if updates are available.

## Recommended Workflow

1. `yarn start` - Install and start development
2. Make changes, test in Obsidian
3. `yarn bacp` - Build and commit changes
4. `yarn v` - Update version
5. `yarn r` - Create release

## Updating Dependencies

```bash
yarn upgrade        # Update all dependencies to latest
```

## More Information

- [obsidian-plugin-config on NPM](https://www.npmjs.com/package/obsidian-plugin-config)
- [obsidian-plugin-config on GitHub](https://github.com/3C0D/obsidian-plugin-config)
- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
