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
    allWsData.sort((a, b) => {
      if (a.columns.length < b.columns.length) return -1
      else if (a.columns.length > b.columns.length) return 1
      else return 0
    })

    var wsSummaryData = allWsData[allWsData.length - 1]
    var groupDeep = wsSummaryData.columns.length - allWsData[0].columns.length + 1
    var valueCols = columnsToList(wsSummaryData.columns.slice(groupDeep))
    var groupCols = columnsToList(wsSummaryData.columns.slice(0, groupDeep))

    var transformedData = summaryDataToTreetableFormat(wsSummaryData.columns, wsSummaryData.data)
    var mainTreeTable = makeTreeTable(transformedData)
    var branchN = 0
    for (var additionalWsData of allWsData.slice(0, allWsData.length - 1).reverse()) {
      var thisWsGroupColumns = intersect(columnsToList(additionalWsData.columns), groupCols)
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
          var lookupRowValues = []
          for (var groupField of thisWsGroupColumns) {
            lookupRowValues.push(groupLookupRow[nameToId(groupField)])
          }

          var thisGroupTotals = additionalWsData.data.filter(
            (row) => {
              for (var i = 0; i < lookupRowValues.length; i++) {
                if (row[i].formattedValue !== lookupRowValues[i]) {
                  return false
                }
              }
              return true
            }
          )[0].slice(-valueCols.length)

          var i = 0
          var finalObj = {}
          for (var valueCol of valueCols) {
            finalObj[nameToId(valueCol)] = thisGroupTotals[i].formattedValue
            i++
          }
          return prop(finalObj)
        }]
      }
      var groupArgs = [groupLevelObj]
      if (branchN > 0) {
        groupArgs.push(0)
      }
      branchN++

    }
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
      transformedRow[nameToId(transformedData.columns[value_n].header.text)] = rowValue.formattedValue
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
    scrollY: true,
    resizeColumn: { headerOnly: true },
    resizeRow: { headerOnly: true }
  }

  return webix.ui(uiParams);
}
