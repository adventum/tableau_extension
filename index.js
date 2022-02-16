var mainAppView = null
var currTableId = ''
var mainTreeTable = null

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

async function initWorksheet(choosedWorksheets) {
  try {
    var allWsData = []
    for (var ws of choosedWorksheets) {
      allWsData.push(await ws.getSummaryDataAsync())
      ws.addEventListener(tableau.TableauEventType.MarkSelectionChanged, e => {
        console.log('tableau.TableauEventType.MarkSelectionChanged')
        initWorksheet(choosedWorksheets)
      });
      ws.addEventListener(tableau.TableauEventType.FilterChanged, e => initWorksheet(choosedWorksheets));
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
    var treeTableObj = makeTreeTable(transformedData)
    if (mainTreeTable) {
      document.querySelector('.webix_dtable').remove()
    }
    mainTreeTable = webix.ui(treeTableObj)
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
      mainTreeTable.group(...groupArgs)

    }

  } catch (e) {
    console.log(e)
  }
}

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
    resizeColumn: { headerOnly: true },
    resizeRow: { headerOnly: true }
  }

  return uiParams;
}
function popupConfigureModal() {
  var dashboard = tableau.extensions.dashboardContent.dashboard;
  var availableWorksheets = dashboard.worksheets
  var configureModal = new bootstrap.Modal(document.getElementById('configureModal'))
  var wsPickOverflow = document.getElementById('ws-pick-overflow')
  wsPickOverflow.innerText = ''
  var alreadyChoosedWs = []
  if (tableau.extensions.settings.get('treetableChoosedWorksheet')) {
    alreadyChoosedWs = JSON.parse(tableau.extensions.settings.get('treetableChoosedWorksheet'))
    console.log('alreadyChoosedWs', alreadyChoosedWs)
  }
  for (var ws of availableWorksheets) {
    var wsFormCheck = document.createElement('div')
    wsFormCheck.classList.add('form-check')

    var wsFormCheckInput = document.createElement('input')
    wsFormCheckInput.classList.add('form-check-input')
    wsFormCheckInput.classList.add('worksheet-check-input')
    var wsFormCheckInputAttrs = {
      type: 'checkbox',
      value: '',
      worksheet_id: nameToId(ws.name)
    }
    for (var [n, v] of Object.entries(wsFormCheckInputAttrs)) {
      wsFormCheckInput.setAttribute(n, v)
    }
    if (alreadyChoosedWs.includes(nameToId(ws.name))) {
      wsFormCheckInput.checked = true
    }

    var wsFormCheckLabel = document.createElement('label')
    wsFormCheckLabel.classList.add('form-check-label')
    wsFormCheckLabel.setAttribute('for', nameToId(ws.name))
    wsFormCheckLabel.innerText = ws.name

    wsFormCheck.appendChild(wsFormCheckInput)
    wsFormCheck.appendChild(wsFormCheckLabel)
    wsPickOverflow?.appendChild(wsFormCheck)

    var saveButton = document.getElementById('save-settings-button')
    saveButton.onclick = (e) => {
      var checkedWorksheetIds = [...document.querySelectorAll('.worksheet-check-input:checked')].map(
        wsInputNode => wsInputNode.getAttribute('worksheet_id')
      )
      tableau.extensions.settings.set('treetableChoosedWorksheet', JSON.stringify(checkedWorksheetIds))
      tableau.extensions.settings.saveAsync()
      initWorksheet(availableWorksheets.filter((ws) => {
        return checkedWorksheetIds.includes(nameToId(ws.name))
      }))
      configureModal.hide()

    }

  }
  configureModal.show()
}

$(document).ready(function () {
  tableau.extensions.initializeAsync({ 'configure': popupConfigureModal }).then(async () => {
    var choosedWorksheetsSettings = tableau.extensions.settings.get('treetableChoosedWorksheet')
    console.log('choosedWorksheetsSettings', choosedWorksheetsSettings)
    if (!choosedWorksheetsSettings) {
      popupConfigureModal()
    } else {
      var dashboard = tableau.extensions.dashboardContent.dashboard;
      var availableWorksheets = dashboard.worksheets
      initWorksheet(availableWorksheets.filter((ws) => {
        return JSON.parse(choosedWorksheetsSettings).includes(nameToId(ws.name))
      }))
    }
  }, function (err) {
    console.error(err)
  });
})