import path from 'path';
import promisify from 'es6-promisify';
import xlsx from 'xlsx';
import _ from 'lodash';

export default async function sortExcel(options)
{
    console.log("sort excel with arguments: ", options);

    if (!options.inputFile){
        throw new Error("No input file!");
    }

    if (!options.outputFile){
        throw new Error("No output file!");
    }

    if (!options.columns){
        throw new Error('No columns to sort!');
    }

    var workbook = xlsx.readFile(options.inputFile);

    console.log('Read workbook sheetnames:');
    for (var name of workbook.SheetNames){
        console.log(name);
    }

    var firstSheetName = workbook.SheetNames[0];
    console.log('First sheet name: ' + firstSheetName);

    var worksheet = workbook.Sheets[firstSheetName];
    var rows = parseWorksheetRows(worksheet);
    console.log("Rows: ");
    console.log(rows);

    var headers = rows.slice(0, 3);
    var data = rows.slice(3);
    console.log('headers: ', headers);
    console.log('data: ', data);

    if (!headers[1]){
        throw new Error("文件内容格式不正确！第二行应该是序号姓名等信息。");
    }

    // 排序文件
    _.each(headers[1], function(colTitle, colLetter){
        if (colLetter === 'A' || colLetter === 'B'){
            return;
        }

        if (options.columns !== '*' && !_.contains(options.columns, colTitle) && !_.contains(options.columns, colLetter)){
            return;
        }


        var sortedData = sortDataByCol(colLetter, data);
        console.log('sorted: ', sortedData);
        var orderColLetter = nextColLetter(colLetter);
        _.each(sortedData, function(x, order){
            if (x){
                worksheet[orderColLetter + '' + x.row] = _.extend(worksheet[orderColLetter + '' + x.row] || {}, {v: order + 1});
            }
        });
    });

    xlsx.writeFile(workbook, options.outputFile);

    return null;
}

function sortDataByCol(col, data)
{
    return _.sortBy(data, function(x){
        return x ? -((+x[col] || -1) * 10000 + (+x.row || -1)) : 0;
    });
}

function nextColLetter(col)
{
    var chars = col.split('');
    var charsLen = chars.length;

    for (var i = charsLen - 1; i >= 0; i++){
        var c = chars[i];
        if (c === 'Z' || c === 'z'){
            continue;
        } else {
            chars[i] = nextChar(c);
            for (i++; i < charsLen; i++){
                chars[i] = 'A';
            }

            return chars.join('');
        }
    }

    return _.range(chars.length + 1).map(function(){return 'A'}).join('');
}

function nextChar(ch)
{
    return String.fromCharCode(ch.charCodeAt(0) + 1);
}

function parseWorksheetColumns(worksheet){
    var columns = {};
    var posRegex = /^([a-zA-Z]+)(\d+)$/;

    for (var pos in worksheet){
        if (!worksheet.hasOwnProperty(pos) || pos[0] === '!'){
            continue;
        }

        var m = posRegex.exec(pos);
        if (!m){
            console.log("Warning: cannot parse pos: " + pos);
            continue;
        }

        var cell = worksheet[pos];
        if (!cell){
            console.log('Warning: empty cell at ' + pos);
            continue;
        }

        var col = m[1];
        var row = +m[2];

        if (typeof columns[col] === 'undefined'){
            columns[col] = {};
        }

        columns[col][row] = cell.v;
    }

    return columns;
}


function parseWorksheetRows(worksheet){
    var rows = {};
    var posRegex = /^([a-zA-Z]+)(\d+)$/;

    for (var pos in worksheet){
        if (!worksheet.hasOwnProperty(pos) || pos[0] === '!'){
            continue;
        }

        var m = posRegex.exec(pos);
        if (!m){
            console.log("Warning: cannot parse pos: " + pos);
            continue;
        }

        var cell = worksheet[pos];
        if (!cell){
            console.log('Warning: empty cell at ' + pos);
            continue;
        }

        var col = m[1];
        var row = +m[2];

        if (typeof rows[row] === 'undefined'){
            rows[row] = {};
        }

        rows[row][col] = cell.v;
    }

    var maxRows = +_.max(_.map(_.keys(rows), parseInt));
    var orderedRows = [];
    orderedRows.length = maxRows;

    for (var i = 1; i < maxRows; i++){
        orderedRows[i - 1] = _.extend({row: i}, rows[i]);
    }

    return orderedRows;
}
