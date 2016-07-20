'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as WebRequest from 'web-request';
// import * as requestPromise from 'request-promise';

// Import language.json for downloading the correct files in the template
// var languagesJSON = require('./languages.json');

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
                if (answer == 'Create a new function...') {
                    if (vscode.workspace.rootPath == undefined) {
                        // Make sure a workspace is setup
                        vscode.window.showErrorMessage("Open a folder first...");
                    } else {
                        // Start the process to create a function
                        console.log(vscode.workspace.rootPath);
                        createAzureFunction();
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

function createAzureFunction () {
    // URL for the templates.json file
    var templatesUrl = "https://ahmelsayed.blob.core.windows.net/public/templates.json";
    var templatesJson = {};

    (async function () {
        templatesJson = await WebRequest.json<any>(templatesUrl);
        console.log(templatesJson);

        var sortedTemplatesByLanguage = {};

        for (var i in templatesJson) {
            var tempID = templatesJson[i].id;
            var tempLang = templatesJson[i].metadata.language;

            if (sortedTemplatesByLanguage.hasOwnProperty(tempLang)) {
                sortedTemplatesByLanguage[tempLang].push(tempID);
            } else {
                sortedTemplatesByLanguage[tempLang] = new Array(tempID);
            }
        }
        
        console.log('asking user for input...');

        // Ask the user to pick a language to use
        var chosenLanguage = "";
        await Promise.resolve(vscode.window.showQuickPick(Object.keys(sortedTemplatesByLanguage)))
        .then(language => {
            chosenLanguage = language;
        });

        console.log('chosenLanguage: ' + chosenLanguage);

        // Ask the user to select the template based on the language
        var chosenTemplate = "";
        await Promise.resolve(vscode.window.showQuickPick(sortedTemplatesByLanguage[chosenLanguage]))
        .then(answer => {
            chosenTemplate = answer;
        });

        console.log('chosenTemplate: ' + chosenTemplate);

        // Download the template
        var githubApiUrl = "https://api.github.com/repos/Azure/azure-webjobs-sdk-templates/contents/Templates";
        var branchIdentifier = "?ref=dev";

        // JSON full of files of the template to download
        // var templateToDownloadJson = await WebRequest.json<any>(githubApiUrl + chosenTemplate + branchIdentifier);
        var urlForTemplateFiles = githubApiUrl + chosenTemplate + branchIdentifier;

        var options = {
            uri: urlForTemplateFiles,
        headers: {
            'User-Agent': 'Request-Promise'
        },
            json: true
        };
        
        // console.log(templateToDownloadJson);
        // for (var file in templateToDownloadJson) {
            // console.log('file: ' + file);
        // }
    })();
}

// this method is called when your extension is deactivated
export function deactivate() {
}