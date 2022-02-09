webix.DataStore.prototype.sorting.as.float = function (a, b) {
  return a > b ? 1 : -1;
}


Array.prototype.getUnique = function () {
  var o = {}, a = [], i, e;
  for (i = 0; e = this[i]; i++) { o[e] = 1 };
  for (e in o) { a.push(e) };
  return a;
}

function intersect(arr1, arr2) {
  return arr1.filter(function (n) {
    return arr2.indexOf(n) !== -1;
  });
}

function columnsToList(columns) {
  var list = []
  for (var c of columns) {
    list.push(c.fieldName)
  }
  return list
}

$(document).ready(function () {
  tableau.extensions.initializeAsync().then(async function () {

    var dashboard = tableau.extensions.dashboardContent.dashboard;
    var dashboardWorksheets = dashboard.worksheets
    var allWsData = []
    for (var ws of dashboardWorksheets) {
      allWsData.push(await ws.getSummaryDataAsync())
    }
    console.log('allWsData', allWsData)
    allWsData.sort((a, b) => {
      if (a.columns.length < b.columns.length) return -1
      else if (a.columns.length > b.columns.length) return 1
      else return 0
    })
    console.log('allWsData 0', allWsData[0])
    console.log('allWsData -1', allWsData[allWsData.length - 1])

    var wsSummaryData = allWsData[allWsData.length - 1]
    var groupDeep = wsSummaryData.columns.length - allWsData[0].columns.length + 1
    var valueCols = columnsToList(wsSummaryData.columns.slice(groupDeep))
    var groupCols = columnsToList(wsSummaryData.columns.slice(0, groupDeep))
    console.log('ws data slices', groupDeep, valueCols, groupCols)

    var transformedData = summaryDataToTreetableFormat(wsSummaryData.columns, wsSummaryData.data)
    console.log(transformedData)
    var mainTreeTable = makeTreeTable(transformedData)
    var branchN = 0
    console.log('----- cycle start')
    for (var additionalWsData of allWsData.slice(0, allWsData.length - 1).reverse()) {
      console.log('additionalWsData', additionalWsData)
      var thisWsGroupColumns = intersect(columnsToList(additionalWsData.columns), groupCols)
      console.log('thisWsGroupColumns', thisWsGroupColumns)
      var groupLevelObj = {
        'by': (obj) => {
          var objGroupValues = []
          for (var groupCol of thisWsGroupColumns) {
            objGroupValues.push(obj[nameToId(groupCol)])
          }
          return objGroupValues.join('-')
        }, 'map': {}
      }
      groupLevelObj.map.value = [nameToId(thisWsGroupColumns[thisWsGroupColumns.length - 1])]
      for (var groupField of thisWsGroupColumns) {
        groupLevelObj.map[nameToId(groupField)] = [nameToId(groupField)]
      }
      for (var valueField of valueCols) {
        groupLevelObj.map[nameToId(valueField)] = [nameToId(valueField), function (prop, data) {
          var groupLookupRow = data[0]
          console.log('groupLookupRow', groupLookupRow)
          var thisGroupTotals = additionalWsData.data.filter(
            (row) => {
              var lookupRowValues = []
              var columnId = 0
              for (var groupField of thisWsGroupColumns) {
                return 123
              }
            }
          )
          return 123
        }]
      }
      var groupArgs = [groupLevelObj]
      if (branchN > 0) {
        groupArgs.push(0)
      }
      branchN++
      console.log('groupArgs', groupArgs)
      mainTreeTable.group(...groupArgs)
      console.log('---------')

    }
    console.log('cycle end')

    // mainTreeTable.group({
    //   by: function (obj) { return obj.YEAR_Order_Date_ + '-' + obj.Category + "-" + obj.Sub_Category },
    //   map: {
    //     value: ["Sub_Category"],
    //     Category: ['Category'],
    //     Sub_Category: ["Sub_Category"],
    //     YEAR_Order_Date_: ['YEAR_Order_Date_'],
    //   }
    // })

    // mainTreeTable.group({
    //   by: function (obj) { return obj.YEAR_Order_Date_ + "-" + obj.Category },
    //   map: {
    //     value: ["Category"],
    //     Category: ['Category'],
    //     YEAR_Order_Date_: ["YEAR_Order_Date_"],
    //   }
    // }, 0)

    // mainTreeTable.group({
    //   by: 'YEAR_Order_Date_',
    //   map: {
    //     value: ["YEAR_Order_Date_"],
    //     YEAR_Order_Date_: ["YEAR_Order_Date_"]
    //   }
    // }, 0)

    webix.ready(function () {
      console.log('before ready')
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
      console.log('after ready')
    });
    // choosedWorksheet.addEventListener(tableau.TableauEventType.FilterChanged, async (filterEvent) => {
    //   console.log('FilterChanged', filterEvent)
    // })
    // choosedWorksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, async (filterEvent) => {
    //   console.log('MarkSelectionChanged', filterEvent)
    // })
    // choosedWorksheet.addEventListener(tableau.TableauEventType.ParameterChanged, async (filterEvent) => {
    //   console.log('ParameterChanged', filterEvent)
    // })

  }, function (err) {
  });
})



function nameToId(name) {
  var charsToReplace = [' ', '(', ')', '%', '-', '[', ']', '.', '?']
  var result = name
  for (var char of charsToReplace) {
    result = result.split(char).join('_')
  }
  return result
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
    scroll: 'xy',
    // scrollY: true,
    resizeColumn: { headerOnly: true },
    resizeRow: { headerOnly: true }
  }

  return webix.ui(uiParams);
}
