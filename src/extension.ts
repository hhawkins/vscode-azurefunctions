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
    "Publish function..."
];

var listOfCLICommands = [
    "help",
    "run",
    "list",
    "kill"
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
        Promise.resolve(vscode.window.showQuickPick(optionsForUser))
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
                } else if (answer == 'Publish this function...') {
                    vscode.window.showInformationMessage("Feature coming soon!");
                } else if (answer == 'Run this function...') {
                    // For demo purposes
                    vscode.window.showInformationMessage("Feature coming soon!");

                    // if (vscode.workspace.rootPath == undefined) {
                    //     // Make sure a workspace is setup
                    //     vscode.window.showErrorMessage("Open a folder first!");
                    // } else {
                    //     // Start the process to create a function
                    //     console.log(vscode.workspace.rootPath);
                    //     var listOfFunctions = getDirectories(vscode.workspace.rootPath);

                    //     Promise.resolve(vscode.window.showQuickPick(listOfFunctions))
                    //         .then(answer => { 
                    //             runAzureFunction(answer);
                    //         })
                    // }
                } else {
                    vscode.window.showInformationMessage("Feature coming soon!");
                }
            });
    });

    context.subscriptions.push(disposable);
}

function runAzureFunction (functionToRun) {
    (async function () {
        var aFunc = path.join(path.dirname(fs.realpathSync(__filename)), '../node_modules/azurefunctions/lib/main.js');
        console.log("aFunc: " + aFunc);
        console.log(__dirname);
        console.log("vscode path: " + vscode.workspace.rootPath);
        // var aFuncProc = await childProcess.spawnSync('node', [aFunc, 'run', functionToRun, '-c', "{'name': 'Hamza'}"], {
        //     cwd: vscode.workspace.rootPath,
        //     stdio: 'inherit'
        // });

        var isWin = /^win/.test(process.platform);
        var aFuncProc = await childProcess.spawn(isWin ? 'cmd' : 'sh', ['azurefunctions', 'run', 'functionToRun'], {
            cwd: vscode.workspace.rootPath
        })

        aFuncProc.stdout.pipe(process.stdout);
        aFuncProc.stderr.pipe(process.stderr);

        console.log("Running function...");
        console.log(aFuncProc);

        aFuncProc.stdout.on('data', function (data) {
            console.log("data: " + data);
        });

        aFuncProc.stdout.on('error', function (err) {
            console.log("error: " + err);
        });
    })();
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

function getDirectories(srcpath) {
    return fs.readdirSync(srcpath).filter(function(file) {
      if (foldersToExclude.indexOf(file) < 0) {
        return fs.statSync(path.join(srcpath, file)).isDirectory();
      }
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
}