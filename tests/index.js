import path from 'path';
import sortExcel from 'app/sort-excel';

console.log("this is a test!");

var testDataFile =  path.resolve(__dirname, 'data/成绩表.xlsx');
var sortedFile = path.resolve(__dirname, 'data/成绩表_已排序.xlsx');

(async function (){
    try {
        await sortExcel({inputFile: testDataFile, outputFile: sortedFile, columns: ['第一单元']});
    } catch (err){
        console.log("Failed to sort!");
        console.log(err);
    }
})();
