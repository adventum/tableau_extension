webix.DataStore.prototype.sorting.as.float = function (a, b) {
  return a > b ? 1 : -1;
}

webix.GroupMethods.total = function (prop, data) {
  console.log('total', data, prop)
  return 123
};

Array.prototype.getUnique = function () {
  var o = {}, a = [], i, e;
  for (i = 0; e = this[i]; i++) { o[e] = 1 };
  for (e in o) { a.push(e) };
  return a;
}

$(document).ready(function () {
  tableau.extensions.initializeAsync().then(async function () {

    var dashboard = tableau.extensions.dashboardContent.dashboard;
    var dashboardWorksheets = dashboard.worksheets

    var choosedWorksheet = dashboardWorksheets[0]
    console.log('dashboardWorksheets', dashboardWorksheets)
    console.log('getUnderlyingDataAsync', await choosedWorksheet.getDataSourcesAsync
      ())
    console.log('worksheetsToTreetable', await worksheetsToTreetable(dashboardWorksheets))

    var wsSummaryData = await choosedWorksheet.getSummaryDataAsync()
    console.log('wsSummaryData', wsSummaryData)

    var transformedData = summaryDataToTreetableFormat(wsSummaryData.columns, wsSummaryData.data)
    console.log(transformedData)
    var mainTreeTable = makeTreeTable(transformedData)
    mainTreeTable.group({
      by: function (obj) { return obj.Category + "-" + obj.Sub_Category },
      map: {
        value: ["Sub_Category"],
        Category: ['Category'],
        Sub_Category: ["Sub_Category"],
        SUM_Profit_: ["SUM_Profit_", "sum"]
      }
    })

    mainTreeTable.group({
      by: "Category",
      map: {
        value: ["Category"],
        // Sub_Category: ["Sub_Category"],
        SUM_Profit_: ["SUM_Profit_", "sum"]
      }
    }, 0);
    // mainTreeTable.group({
    //   by: 'Sub_Category',
    //   row: 'Category'
    // })

    // var mainTreeTable = await worksheetsToTreetable(dashboardWorksheets)
    webix.ready(function () {
      webix.ui({
        view: "scrollview",
        body: {
          rows: [
            webix.ui({
              mainTreeTable
            })
          ]
        }
      });
    });
    choosedWorksheet.addEventListener(tableau.TableauEventType.FilterChanged, async (filterEvent) => {
      console.log('FilterChanged', filterEvent)
    })
    choosedWorksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, async (filterEvent) => {
      console.log('MarkSelectionChanged', filterEvent)
    })
    // choosedWorksheet.addEventListener(tableau.TableauEventType.ParameterChanged, async (filterEvent) => {
    //   console.log('ParameterChanged', filterEvent)
    // })

  }, function (err) {
  });
})



function nameToId(name) {
  var charsToReplace = [' ', '(', ')', '%', '-', '[', ']']
  var result = name
  for (var char of charsToReplace) {
    result = result.split(char).join('_')
  }
  return result
}

async function worksheetsToTreetable(worksheets) {
  var worksheetsSummaryData = []
  var dataTree = { columns: [], data: [] }
  for (var ws of worksheets) {
    var wsSummaryData = await ws.getSummaryDataAsync()
    worksheetsSummaryData.push(wsSummaryData)
  }
  worksheetsSummaryData.sort((a, b) => { a.columns.length - b.columns.length })
  console.log('worksheetsSummaryData', worksheetsSummaryData)
  var groupDeep = worksheetsSummaryData[0].columns.length - worksheetsSummaryData[worksheetsSummaryData.length - 1].columns.length + 1
  var valueCols = worksheetsSummaryData[0].columns.slice(groupDeep)
  var groupCols = worksheetsSummaryData[0].columns.slice(0, groupDeep)
  console.log('groupDeep', groupDeep)
  console.log('groupCols', groupCols)
  console.log('valueCols', valueCols)

  var col_n = 0
  for (var col_field of worksheetsSummaryData[0].columns) {
    var columnData = {
      id: nameToId(col_field.fieldName),
      header: { text: col_field.fieldName },
      fillspace: true,
      sort: col_field.dataType
    }
    if (col_n === 0) {
      columnData.template = `{common.icon()} #${columnData.id}#`
    } else {

    }
    col_n++
    dataTree.columns.push(columnData)
  }
  console.log('dataTree', JSON.stringify(dataTree))

  // 
  // var currentDeep = 0
  // for (var ws of worksheetsSummaryData.reverse()) {
  //   var currentGroup = dataTree
  //   if (currentDeep > 0) {
  //     for (var i of [...Array(currentDeep).keys()]) {
  //       currentGroup = currentGroup[currentDeep - 1]
  //     }
  //   }
  //   for (var row of ws.data) {
  //     var transformedRowData = {}
  //     currentGroup.data.push(transformedRowData)
  //   }
  //   console.log('--------')
  //   console.log('ws', ws)
  //   console.log('currentGroup', currentGroup)
  //   console.log('--------')
  //   currentGroup.push({ hui: 1, data: {} })
  //   currentDeep++
  // }

  function rowsInObjects(data, columns) {
    var rowsToReturn = []
    for (var row of data) {
      var dict = {}
      var curFieldNum = 0
      for (var valueArray of row) {
        dict[nameToId(columns[curFieldNum].fieldName)] = row[curFieldNum].formattedValue
        curFieldNum++
      }
      rowsToReturn.push(dict)
    }
    return rowsToReturn
  }

  var currentWorksheetNum = 0
  var lastData = [dataTree]
  var dataBuffer = []
  console.log('------')
  for (var currentWorksheet of worksheetsSummaryData.reverse()) {
    console.log('currentWorksheetNum', currentWorksheetNum)
    console.log('lastData', lastData)
    console.log('dataBuffer', dataBuffer)
    console.log('currentWorksheet', currentWorksheet)
    var thisWorksheetFlatObjs = rowsInObjects(currentWorksheet.data, currentWorksheet.columns)
    if (currentWorksheetNum === 0) {
      console.log('First ws, dont group!')
      dataBuffer = thisWorksheetFlatObjs
    } else {
      console.log('Additional ws, group!')
      var currentGroupField = nameToId(groupCols[currentWorksheetNum - 1].fieldName)
      for (var lastHeaderObj of lastData) {
        console.log('Extending ', lastHeaderObj)
        console.log('thisWorksheetFlatObjs', thisWorksheetFlatObjs)
        var thisGroupObjs = thisWorksheetFlatObjs.filter(obj => obj[currentGroupField] === lastHeaderObj[currentGroupField]) || []
        console.log('Groupped ' + currentGroupField + '(by ' + lastHeaderObj[currentGroupField] + ')')
        console.log('thisGroupObjs', JSON.stringify(thisGroupObjs))
        lastHeaderObj.data = thisGroupObjs
        dataBuffer = dataBuffer.concat(lastHeaderObj.data)
      }

    }
    console.log('last ws data buffer', dataBuffer)
    lastData = dataBuffer
    dataBuffer = []
    currentWorksheetNum++
    console.log('-------')

  }
  console.log('-------')
  console.log('dataTree', dataTree)
}

function summaryDataToTreetableFormat(summaryDataColumns, summaryDataData) {
  var transformedData = {}
  transformedData.columns = []
  var col_n = 0
  for (var col_field of summaryDataColumns) {
    var columnData = {
      id: nameToId(col_field.fieldName),
      header: { text: col_field.fieldName },
      fillspace: true,
      sort: col_field.dataType
    }
    if (col_n === 0) {
      columnData.template = `{common.icon()} #${columnData.id}#`
    }
    col_n++
    transformedData.columns.push(columnData)
  }
  transformedData.data = []
  var rowId = 0
  for (var row of summaryDataData) {
    var transformedRow = {}
    var value_n = 0
    transformedRow['id'] = rowId
    rowId++
    for (var rowValue of row) {
      transformedRow[nameToId(transformedData.columns[value_n].header.text)] = rowValue.nativeValue
      value_n++
    }
    transformedData.data.push(transformedRow)
  }
  return transformedData
}

function makeTreeTable(transformedData) {
  var uiParams = {
    view: "treetable",
    columns: transformedData.columns,
    data: transformedData.data,
    css: "webix_header_border webix_data_border multiline",
    clipboard: "selection",
    select: "cell",
    multiselect: true,
    // scheme: {
    //   $group: {
    //     by: transformedData.columns[0].id,
    //     map: {}
    //   }
    // },
    scroll: 'xy',
    // scrollY: true,
    resizeColumn: { headerOnly: true },
    resizeRow: { headerOnly: true }
  }
  // for (var col of transformedData.columns) {
  //   console.log('col', col)
  //   var totalFunctComp = ['SUM', 'AGG', 'CNT', 'CNTD']
  //   uiParams.scheme.$group.map[col.id] = [
  //     col.id,
  //     'sum'
  //   ]
  // }

  return webix.ui(uiParams);
}
