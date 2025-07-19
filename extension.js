// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const { ExtensionActivator } = require('./concepts/extension/activator');

// Create a single instance of the extension activator
const extensionActivator = new ExtensionActivator();

/**
 * @param {import('vscode').ExtensionContext} context
 */
function activate(context) {
    extensionActivator.activate(context);
}

function deactivate() {
    extensionActivator.deactivate();
}

module.exports = {
    activate,
    deactivate
}
