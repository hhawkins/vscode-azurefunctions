'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as WebRequest from 'web-request';
import * as requestPromise from 'request-promise';
import * as fs from "fs";
import * as path from "path";
import * as request from "request";


var filesToExclude = [
    "test.json",
    "readme.md",
    "metadata.json"
];

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
                        vscode.window.showErrorMessage("Open a folder first!");
                    } else {
                        // Start the process to create a function
                        console.log(vscode.workspace.rootPath);
                        createAzureFunction();
                    }
                }

                if (answer == 'Publish this function...') {
                    vscode.window.showInformationMessage("Feature coming soon!");
                }

                if (answer == 'Run this function...') {
                    vscode.window.showInformationMessage("Feature coming soon!");
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
        var githubApiUrl = "https://api.github.com/repos/Azure/azure-webjobs-sdk-templates/contents/Templates/";
        var branchIdentifier = "?ref=dev";

        // JSON full of files of the template to download
        var urlForTemplateFiles = githubApiUrl + chosenTemplate + branchIdentifier;

        var options = {
            uri: urlForTemplateFiles,
        headers: {
            'User-Agent': 'Request-Promise'
        },
            json: true
        };

        // Ask the user the enter a name for the function
        var nameForFunction = "";
        await Promise.resolve(vscode.window.showInputBox({
            placeHolder: "Name",
            prompt: "Enter a name for the function (The folder created will have this name)",
            value: "MyFunction"
            }))
        .then(answer => {
            nameForFunction = answer;
        });
        
        console.log("nameForFunction: " + nameForFunction);
        var pathToSaveFunction = path.resolve(vscode.workspace.rootPath, nameForFunction);
        console.log(pathToSaveFunction);

        if (!fs.statSync(pathToSaveFunction).isDirectory()) {
            console.log("Creating the directory...");
            await fs.mkdirSync(pathToSaveFunction);
        }

        // Function to download the files
        var downloadFiles = function (filesToDownload) {
            for (let file in filesToDownload) {
            console.log("downloading " + file);
            console.log("from " + filesToDownload[file] + "...")
            console.log(path.resolve(pathToSaveFunction, file))

            request
                .get(filesToDownload[file])
                .on('error', err => {
                console.log('There was an error when downloading the file ' + file);
                console.log(err);
                })
                .pipe(fs.createWriteStream(path.resolve(pathToSaveFunction, file)));
            }
          };

        requestPromise(options)
        .then(templates => {
            var filesToDownload = {};

            for (var file in templates) {
                if (filesToExclude.indexOf(templates[file].name) < 0) {
                    // Download the file
                    filesToDownload[templates[file].name] = templates[file].download_url;
                }
            }

            console.log("filesToDownload: " + Object.keys(filesToDownload));
            downloadFiles(filesToDownload);

            return 1;
        })
        .catch(err => {
            console.log("There was an error in searching through the template");
            console.log(err);
        })
    })();
}

// this method is called when your extension is deactivated
export function deactivate() {
}