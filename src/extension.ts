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
    "Run a function...",
    "Log into azure portal...",
    "List function apps in current tenant..."
];

// Setup the output channel to display the results of the CLI
var outputChannel = vscode.window.createOutputChannel("Azure Functions");

// This method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vscode-azurefunctions" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.azureFunctions', () => {
        // The code you place here will be executed every time your command is executed

        // Lets give the user some options
        // **Note: The create and run functionality has unique implementations when compared to other CLI commands
        // ** Refer to them for implementing more complex interactions below 
        // var userChoice = vscode.window.showQuickPick(optionsForUser);
        // Promise.prototype
        Promise.resolve(vscode.window.showQuickPick(optionsForUser))
        .then(answer => {
            // Run the 'login' command in the CLI
            if (answer == 'Log into azure portal...') {
                runCLI('login');
            } 
            
            // Run the 'list' command in the CLI
            else if (answer == 'List function apps in current tenant...') {
                runCLI('list');
            }

            // Have the user go through a process to create a new function
            // Because of the nature of input and output, the process to create a new function is handled through the
            // createAzureFunction() function below and not through the cli itself
            else if (answer == 'Create a new function...') {
                if (vscode.workspace.rootPath == undefined) {
                    // Make sure a workspace is setup
                    vscode.window.showErrorMessage("Open a folder first!");
                } else {
                    // Start the process to create a function
                    console.log(vscode.workspace.rootPath);
                    createAzureFunction();
                }
            }

            // Run a user specified function
            else if (answer == 'Run a function...') {
                if (vscode.workspace.rootPath == undefined) {
                    // Make sure a workspace is setup
                    vscode.window.showErrorMessage("Open a folder first!");
                } else {
                    // Start the process to run a function
                    var listOfFunctions = getDirectories(vscode.workspace.rootPath);

                    // Ask the user to enter arguments
                    var userArgument = vscode.window.showQuickPick(listOfFunctions);
                    if (userArgument != undefined) {
                        userArgument.then(functionName => {
                            var prompt = "Enter arguments";
                            vscode.window.showInputBox({
                                placeHolder: "Arguments",
                                prompt: prompt,
                                value: ''
                            })
                            .then(userArgument => {
                                // Run the function that the user chose with arguments
                                if (userArgument.length > 0) {
                                    runCLI('run', functionName, userArgument);
                                } else {
                                    runCLI('run', functionName);
                                }
                            });
                        }, reason => {
                            console.log(reason);
                        })
                    }
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

    var options = {
        uri: templatesUrl,
    headers: {
        'User-Agent': 'Request-Promise'
    },
        json: true
    };

    // Take a look at the templates json file
    requestPromise(options)
    .then( templates => {
        console.log(templates);

        // Start going through the process of sorting through the templates json file
        Promise.resolve(startProcessing(templates));

        // The start...
        function startProcessing (templatesToSort) {
            return Promise.resolve(sortTheTemplates(templatesToSort));
        }
        
        // Sort the templates by language
        function sortTheTemplates (templatesToSort) {
            var sortedTemplatesByLanguage = {};

            for (var i in templatesToSort) {
                var tempID = templatesToSort[i].id;
                var tempLang = templatesToSort[i].metadata.language;

                if (sortedTemplatesByLanguage.hasOwnProperty(tempLang)) {
                    sortedTemplatesByLanguage[tempLang].push(tempID);
                } else {
                    sortedTemplatesByLanguage[tempLang] = new Array(tempID);
                }
            }

            return Promise.resolve(askUserToPickLanguage(sortedTemplatesByLanguage));
        }

        // Ask the user to pick a language to use
        function askUserToPickLanguage (sortedTemplates) {
            console.log('Asking user for language to use...');
            return Promise.resolve(vscode.window.showQuickPick(Object.keys(sortedTemplates)))
            .then(language => {
                if (language != undefined) {
                    console.log('Language: ' + language);
                    askUserForTemplate(sortedTemplates, language)
                } else {
                    console.log('User did not select a language...');
                }
            });
        }

        // Ask the user to select the template based on the language
        function askUserForTemplate (sortedTemplates, chosenLanguage) {
            console.log('Asking user for template to use...');
            return Promise.resolve(vscode.window.showQuickPick(sortedTemplates[chosenLanguage]))
            .then(chosenTemplate => {
                if (chosenTemplate != undefined) {
                    console.log('Chosen template: ' + chosenTemplate);
                    askForNameOfFunction(false, "", chosenTemplate);
                } else {
                    console.log('User did not choose a template...');
                }
            });
        }

        // Ask the user the enter a name for the function
        function askForNameOfFunction(folderExists = false, folder = "", nameOfTemplate = "") {
            var pathToUse = "";
            var defaultValue = "MyAzureFunction"
            var prompt = "Enter a name for the function (the folder created will have this name)";

            if (folderExists == true) {
                prompt = "The folder " + folder + " exists. Use a different name.";
                defaultValue = folder;
            }

            Promise.resolve(vscode.window.showInputBox({
                placeHolder: "Name for function",
                prompt: prompt,
                value: defaultValue
            }))
            .then(answer => {
                if (answer != undefined) {
                    try {
                        pathToUse = path.resolve(vscode.workspace.rootPath, answer);
                        fs.mkdirSync(pathToUse);
                        downloadTheTemplate(nameOfTemplate, answer, pathToUse);
                    } catch (err) {
                        console.log("Folder exists");
                        return askForNameOfFunction(true, answer, nameOfTemplate);
                    }
                } else {
                    console.log('User did not enter a function name...');
                }
            });
            // var pathToSaveFunction = askForNameOfFunction();
        }

        function downloadTheTemplate (userChosenTemplate, nameForTheFunction, pathToUse) {
            // Download the template
            var githubApiUrl = "https://api.github.com/repos/Azure/azure-webjobs-sdk-templates/contents/Templates/";
            var branchIdentifier = "?ref=dev";

            // JSON full of files of the template to download
            var urlForTemplateFiles = githubApiUrl + userChosenTemplate + branchIdentifier;

            var options = {
                uri: urlForTemplateFiles,
                headers: {
                    'User-Agent': 'Request-Promise'
                },
                json: true
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

            // Function to download the files
            var downloadFiles = function (filesToDownload) {
                for (let file in filesToDownload) {
                console.log("downloading " + file);
                console.log("from " + filesToDownload[file] + "...")
                console.log(path.resolve(pathToUse, file))

                request
                    .get(filesToDownload[file])
                    .on('error', err => {
                    console.log('There was an error when downloading the file ' + file);
                    console.log(err);
                    })
                    .pipe(fs.createWriteStream(path.resolve(pathToUse, file)));
                }
            };
        }
    })
    .catch( err => {
        console.log("There was an error in searching for templates");
    });
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
    outputChannel.clear();
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