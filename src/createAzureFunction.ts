'use strict';
import * as vscode from 'vscode';
import * as request from 'request';

export function gatherTemplates () {
    var templatesUrl = "https://ahmelsayed.blob.core.windows.net/public/templates.json";
    var fileName = "templates.json";
    var templatesJson = {};

    request
        .get(templatesUrl)
        .on('end', () => {
            //templatesJson = require(('./templates.json'));
        })
}