# Change Log

All notable changes to the "elementarywatson" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.2.0] - 2025-07-22

### Added
- **New Sidebar UI**: Dedicated sidebar view to showcase current translation keys in the active file
- **Enhanced Navigation**: Made translation labels clickable in both the editor (via CodeLens) and extension UI for quick navigation to translation files
- **Real-time Updates**: Configurable real-time translation label updates while typing with debounce delay settings (100-2000ms)
- **Configuration Options**: 
  - `elementaryWatson.defaultLocale`: Set default locale for displaying translation labels
  - `elementaryWatson.realtimeUpdates`: Toggle real-time updates on/off
  - `elementaryWatson.updateDelay`: Configure debounce delay for real-time updates
- **Improved Commands**:
  - `elementaryWatson.refreshSidebar`: Refresh sidebar content
  - `elementaryWatson.openTranslationFile`: Open translation files directly from UI
- **Enhanced Text Extraction**: Improved extraction service with automatic quote stripping functionality

### Changed
- **Preserved Key Order**: Translation file updates now maintain the original key order in language JSON files (no reordering)
- **Enhanced File Watching**: Improved file watchers for translation files to support real-time sidebar updates

### Improved
- Better user experience with clickable labels for seamless navigation between code and translation files
- More responsive UI with configurable update delays to balance performance and real-time feedback

## [0.1.0] - 2025-07-21

### Added
- **Initial Release**: Basic extension functionality for Paraglide JS i18n integration
- **Translation Label Display**: Simple inline display of translation values for Paraglide JS i18n method calls in Svelte/SvelteKit applications
- **Text Extraction Logic**: Core functionality to extract text and recreate language JSON files
- **Basic Commands**:
  - `elementaryWatson.changeLocale`: Change label locales
  - `elementaryWatson.extractText`: Extract text to locale files
- **Multi-language Support**: Activation for JavaScript, TypeScript, and Svelte files
- **License and Documentation**: Added MIT license and initial documentation

[0.2.0]: https://github.com/romerramos/elementary-watson/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/romerramos/elementary-watson/releases/tag/v0.1.0