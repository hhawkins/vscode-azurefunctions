'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as WebRequest from 'web-request';
import * as requestPromise from 'request-promise';
import * as childProcess from 'child_process';
import * as fs from "fs";
import * as path from "path";
import * as request from "request";

var filesToExclude = [
    "test.json",
    "readme.md",
    "metadata.json"
];

var foldersToExclude = [
    "data",
    "secrets"
];

var optionsForUser = [
    "Create a new function...",
    // "Publish function...",
    "Run a function..."
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
        var userChoice = vscode.window.showQuickPick(optionsForUser);
        userChoice
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
                } else if (answer == 'Publish function...') {
                    vscode.window.showInformationMessage("Feature coming soon!");

                } else if (answer == 'Run a function...') {
                    // For demo purposes
                    // vscode.window.showInformationMessage("Feature coming soon!");

                    if (vscode.workspace.rootPath == undefined) {
                        // Make sure a workspace is setup
                        vscode.window.showErrorMessage("Open a folder first!");
                    } else {
                        // Start the process to create a function
                        var listOfFunctions = getDirectories(vscode.workspace.rootPath);

                        Promise.resolve(vscode.window.showQuickPick(listOfFunctions))
                            .then(functionName => {
                                var prompt = "Enter arguments";
                                vscode.window.showInputBox({
                                    placeHolder: "Arguments",
                                    prompt: prompt,
                                    value: ''
                                })
                                .then(userArgument => {
                                     if (userArgument.length > 0) {
                                        runCLI('run', functionName, userArgument);
                                    } else {
                                        runCLI('run', functionName);
                                    }
                                });
                            }, reason => {
                                console.log(reason);
                            })
                            .catch(error => {
                                console.log("error: " + error);
                            });
                    }
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
        console.log("Creating function...")
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
        var languageChoice = vscode.window.showQuickPick(Object.keys(sortedTemplatesByLanguage));
        languageChoice
        .then(language => {
            chosenLanguage = language;
        }, reason => {
            console.log(reason);
        });

        console.log('chosenLanguage: ' + chosenLanguage);

        // Ask the user to select the template based on the language
        var chosenTemplate = "";
        var templateChoice = vscode.window.showQuickPick(sortedTemplatesByLanguage[chosenLanguage]);
        templateChoice
        .then(answer => {
            chosenTemplate = answer;
        }, reason => {
            console.log(reason);
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
        var askForNameOfFunction = async function (folderExists = false, folder = "") {
            var nameForFunction = "";
            var pathToReturn = "";
            var defaultValue = "MyAzureFunction"
            var prompt = "Enter a name for the function (the folder created will have this name)";

            if (folderExists == true) {
                prompt = "The folder " + folder + " exists. Use a different name.";
                defaultValue = folder;
            }

            await Promise.resolve(vscode.window.showInputBox({
                placeHolder: "Name for function",
                prompt: prompt,
                value: defaultValue
            }))
            .then(answer => {
                nameForFunction = answer;
            }, reason => {
                console.log(reason);
            })
            .catch(error => {
                console.log("error: " + error);
            });

            try {
                pathToReturn = path.resolve(vscode.workspace.rootPath, nameForFunction);
                fs.mkdirSync(pathToReturn);
                return pathToReturn;
            } catch (err) {
                console.log("Folder exists");
                return await askForNameOfFunction(true, nameForFunction);
            }
        }

        var pathToSaveFunction = await askForNameOfFunction();

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

function runCLI (command, functionName = null, argument = null) {
    if (functionName == null && argument == null) {
        var isWin = /^win/.test(process.platform);
        var cliProc = childProcess.spawnSync(isWin ? 'cmd' : 'sh', [isWin ? '/c' : '-c', 'azurefunctions', command], {
            cwd: vscode.workspace.rootPath
        });
    } else if (functionName != null && argument != null) {
        var isWin = /^win/.test(process.platform);
        var cliProc = childProcess.spawnSync(isWin ? 'cmd' : 'sh', [isWin ? '/c' : '-c', 'azurefunctions', command, functionName, argument], {
            cwd: vscode.workspace.rootPath
        });
    } else if (functionName != null) {
        var isWin = /^win/.test(process.platform);
        var cliProc = childProcess.spawnSync(isWin ? 'cmd' : 'sh', [isWin ? '/c' : '-c', 'azurefunctions', command, functionName], {
            cwd: vscode.workspace.rootPath
        });
    }

    console.log(cliProc.stdout.toString());
    displayToOutput(cliProc.stdout.toString());
}

function displayToOutput (textToDisplay) {
    var outputChannel = vscode.window.createOutputChannel("Azure Functions");

    outputChannel.append(textToDisplay);
    outputChannel.show(true);
}

function getDirectories(srcpath) {
    return fs.readdirSync(srcpath).filter(function(file) {
      if (foldersToExclude.indexOf(file) < 0) {
        return fs.statSync(path.join(srcpath, file)).isDirectory();
      }
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('af deactivated');
}