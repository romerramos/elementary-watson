# ElementaryWatson - i18n Translation Companion

A VS Code extension that displays inline translation values for i18n method calls in JavaScript, TypeScript, and Svelte applications. Supports inlang project structure and Paraglide JS, making it easier to see what text will be displayed without leaving your editor.

## Features

- **Inline Translation Display**: Shows the actual translation text next to `m.methodName()` calls in a faded, italic style
- **Real-time Updates**: Automatically updates translation displays when you save JS/TS files
- **Import Resolution**: Follows import statements to locate your translation modules
- **SvelteKit Alias Support**: Properly resolves SvelteKit aliases like `$lib`, `$app`
- **Multiple Import Patterns**: Supports various import styles:
  - `import * as m from './translations'`
  - `import { m } from './translations'`
  - `import m from './translations'`
  - `import * as m from '$lib/paraglide/messages'` (SvelteKit)
- **Parameter Support**: Handles translation methods with parameters
- **Multi-language Support**: Works with multiple locales and configurable locale switching
- **inlang Project Support**: Automatically detects and uses inlang project configuration
- **Flexible Configuration**: Command palette integration for easy locale switching

## Project Structure Support

ElementaryWatson supports two project structures:

### 1. inlang Projects (Recommended)

If your project has a `project.inlang/settings.json` file, the extension will:
- Read the `pathPattern` from `plugin.inlang.messageFormat` to locate translation files
- Use the `baseLocale` as the default display locale
- Respect your inlang configuration automatically

Example `project.inlang/settings.json`:
```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-m-function-matcher@2/dist/index.js"
  ],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{locale}.json"
  },
  "baseLocale": "en",
  "locales": ["en", "es", "fr"]
}
```

### 2. Simple Messages Directory (Fallback)

If no inlang configuration is found, the extension falls back to:
- Looking for translation files in `./messages/{locale}.json`
- Using "en" as the default locale

## Configuration & Locale Management

### Changing Display Locale

1. **Command Palette**: Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Search for "Change Label Locales"
3. Enter your desired locale code (e.g., "es", "fr", "de")

### VS Code Settings

Configure the default locale in your VS Code settings:

```json
{
  "elementaryWatson.defaultLocale": "es"
}
```

### Locale Priority Order

The extension determines which locale to display using this priority:
1. VS Code workspace setting (`elementaryWatson.defaultLocale`)
2. `baseLocale` from `project.inlang/settings.json`
3. Default fallback: "en"

## How It Works

When you save a JavaScript, TypeScript, or Svelte file, ElementaryWatson:

1. Scans for `m.methodName()` calls in your code
2. Determines the current locale (from settings, inlang config, or default)
3. Locates translation files using inlang `pathPattern` or fallback structure
4. Loads the appropriate translation file for the current locale
5. Displays the translation values inline as styled decorations

## Example

**In a Svelte component:**

```svelte
<script>
import * as m from '$lib/paraglide/messages';

const title = m.hello_world();        // "Hello World"
const greeting = m.welcome_message(); // "Welcome, User"
</script>

<h1>{title}</h1>
<p>{greeting}</p>
```

**In SvelteKit routes/pages:**

```javascript
import * as m from '$lib/paraglide/messages';

export function load() {
    return {
        title: m.page_title(),     // "My SvelteKit App"
        description: m.page_desc() // "Welcome to our application"
    };
}
```

## Requirements

- VS Code 1.99.3 or higher
- JavaScript/TypeScript/Svelte project with i18n setup
- Translation files in JSON format
- Either an inlang project configuration or a `messages/` directory structure

## Supported File Types

- JavaScript (`.js`)
- TypeScript (`.ts`)
- Svelte (`.svelte`)

## Quick Setup

The extension works automatically with minimal setup:

1. **For inlang projects**: Ensure you have `project.inlang/settings.json` configured
2. **For simple projects**: Create a `messages/` directory with `{locale}.json` files  
3. **Translation files**: Use JSON format with key-value pairs
4. **Code**: Use `m.methodName()` pattern in your JavaScript/TypeScript/Svelte files

Example translation file (`messages/en.json`):
```json
{
  "hello_world": "Hello World",
  "welcome_message": "Welcome, User",
  "page_title": "My App"
}
```

## Known Limitations

- Only works with the variable name `m` for translation calls
- Parameter parsing is basic (supports simple JSON-like objects)
- Requires translation modules to be valid JavaScript/TypeScript files
- Updates on file save, not real-time typing

## Performance

- Lightweight: Only processes files when saved
- Smart caching: Reloads translation modules as needed
- Minimal UI impact: Uses VS Code's efficient decoration API

## Troubleshooting

If translations don't appear:

1. **Check locale**: Verify the current locale has a corresponding translation file
2. **Check file structure**: 
   - For inlang projects: Verify `project.inlang/settings.json` and `pathPattern` are correct
   - For simple projects: Ensure `messages/{locale}.json` files exist
3. **Check translation files**: Ensure JSON files are valid and contain the expected keys
4. **Check console**: Open VS Code Developer Console (Help → Toggle Developer Tools) for error messages
5. **Try changing locale**: Use "Change Label Locales" command to test different locales

### Common Issues

- **File not found**: Check that translation files exist in the expected location
- **Locale mismatch**: Ensure your current locale setting matches available translation files
- **JSON syntax**: Verify translation files have valid JSON syntax
- **Path pattern**: For inlang projects, check that `pathPattern` correctly resolves to your files

## Contributing

This extension is designed for i18n workflows using the `m.methodName()` pattern, with support for inlang projects and simple message directory structures. For issues or feature requests, please ensure they align with these use cases.

---

**Enjoy cleaner i18n development with ElementaryWatson!**
