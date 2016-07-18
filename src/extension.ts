'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vscode-azurefunctions" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.azureFunctions', () => {
        // The code you place here will be executed every time your command is executed

        // Give the user some options
        Promise.resolve(vscode.window.showQuickPick(['Create a new function...', 'Publish this function...', 'Run this function...']))
            .then(answer => {
                vscode.window.showInformationMessage("You chose " + answer);

                if (answer == 'Create a new function...') {
                    if (vscode.workspace.rootPath == undefined) {
                        // Make sure a workspace is setup
                        vscode.window.showErrorMessage("Open a folder first...");
                    } else {
                        // Start the process to create a function
                        
                    }
                }

                if (answer == 'Publish this function...') {
                }

                if (answer == 'Run this function...') {
                }
            });
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}