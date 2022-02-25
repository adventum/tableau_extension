var currTableId = ''
var mainTreeTable = null
var loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'))
var isEventListenersPassed = false
var imageColumns = []
var checkedColumnsFromWs = []


webix.DataStore.prototype.sorting.as.float = function (a, b) {
  return a > b ? 1 : -1;
}

const zip = (a, b) => a.map((k, i) => [k, b[i]]);

Array.prototype.getUnique = function () {
  var o = {}, a = [], i, e;
  for (i = 0; e = this[i]; i++) { o[e] = 1 };
  for (e in o) { a.push(e) };
  return a;
}

function getArrayIntersectValues(arr1, arr2) {
  return arr1.filter(function (n) {
    return arr2.indexOf(n) !== -1;
  });
}

function wsColumnsToList(columns) {
  var list = []
  for (var c of columns) {
    list.push(c.fieldName)
  }
  return list
}

async function getWsSummaryData(wsList) {
  var allWsData = []
  for (var ws of wsList) {
    allWsData.push([ws, await ws.getSummaryDataAsync()])
  }
  return allWsData
}

function auditWsCols(allWsData) {
  /* Returns object with all worksheets details: 
    groupCols: columns that should be used for grouping
    valueCols: columns that should be used for totals and subtotals
    groupDeep: count of groupCols
    wsSummaryData: summary data of bigest worksheet
    allWsCols
  */
  allWsData.sort((a, b) => {
    if (a[1].columns.length < b[1].columns.length) return -1
    else if (a[1].columns.length > b[1].columns.length) return 1
    else return 0
  })
  console.log('allWsData', allWsData)
  var wsSummaryData = allWsData[allWsData.length - 1][1]
  var groupDeep = wsSummaryData.columns.length - allWsData[0][1].columns.length + 1
  var valueCols = wsColumnsToList(wsSummaryData.columns.slice(groupDeep))
  var groupCols = wsColumnsToList(wsSummaryData.columns.slice(0, groupDeep))
  return {
    groupCols: groupCols, valueCols: valueCols, wsSummaryData: wsSummaryData, groupDeep: groupDeep
  }
}

async function initWorksheet(choosedWorksheets) {
  loadingModal.show()
  try {
    var allWsData = await getWsSummaryData(choosedWorksheets)
    if (!isEventListenersPassed) {
      choosedWorksheets[0].addEventListener(tableau.TableauEventType.MarkSelectionChanged, e => {
        initWorksheet(choosedWorksheets)
      });
      choosedWorksheets[0].addEventListener(tableau.TableauEventType.FilterChanged, e => initWorksheet(choosedWorksheets));
      isEventListenersPassed = true
    }
    var allWsAuditDetails = auditWsCols(allWsData)

    var transformedData = summaryDataToTreetableFormat(allWsAuditDetails.wsSummaryData.columns, allWsAuditDetails.wsSummaryData.data, allWsAuditDetails)
    var treeTableObj = makeTreeTable(transformedData)
    if (mainTreeTable) {
      document.querySelector('.webix_dtable').remove()
    }
    mainTreeTable = webix.ui(treeTableObj)
    var branchN = 0
    for (var [_, additionalWsData] of allWsData.slice(0, allWsData.length - 1).reverse()) {
      var thisWsGroupColumns = getArrayIntersectValues(wsColumnsToList(additionalWsData.columns), allWsAuditDetails.groupCols)
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
      for (var valueField of allWsAuditDetails.valueCols) {
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
          )[0].slice(-allWsAuditDetails.valueCols.length)

          var i = 0
          var finalObj = {}
          for (var valueCol of allWsAuditDetails.valueCols) {
            finalObj[nameToId(valueCol)] = thisGroupTotals[i].formattedValue
            i++
          }
          if (prop === undefined) {
            return ''
          }
          return prop(finalObj)
        }]
        if (imageColumns.includes(nameToId(valueField))) {
          groupLevelObj.map[nameToId(valueField)] = [nameToId(valueField), function (prop, data) {
            return ''
          }]
        }
      }
      var groupArgs = [groupLevelObj]
      console.log(groupArgs)
      if (branchN > 0) {
        groupArgs.push(0)
      }
      branchN++
      mainTreeTable.group(...groupArgs)
    }
    mainTreeTable.attachEvent("onAfterOpen", function () {
      console.log('a')
      mainTreeTable.adjustRowHeight()
    });
    mainTreeTable.adjustRowHeight()
  } catch (e) {
    console.log(e)
  }
  loadingModal.hide()
}

function nameToId(name) {
  var charsToReplace = [' ', '(', ')', '%', '-', '[', ']', '.', '?']
  var result = name
  for (var char of charsToReplace) {
    result = result.split(char).join('_')
  }
  return result
}


function summaryDataToTreetableFormat(summaryDataColumns, summaryDataData, wsDataAudit) {
  var transformedData = {}
  transformedData.columns = []
  var col_n = 0
  var groupColumnData = {
    id: 'group',
    header: { text: "Group" },
    fillspace: true,
    sort: 'string',
    template: (obj, common) => {
      return common.treetable(obj, common) + obj[nameToId(wsDataAudit.groupCols[obj.$level - 1])]
    }
  }
  transformedData.columns.push(groupColumnData)
  for (let col_field of wsDataAudit.valueCols) { // let is need for variable closure
    var rawColumn = summaryDataColumns.filter(c => nameToId(c.fieldName) === nameToId(col_field))[0]
    console.log('rawColumn', rawColumn)
    var columnData = {
      id: nameToId(col_field),
      header: { text: col_field },
      fillspace: true,
      sort: rawColumn.dataType,
      template: (obj, common) => {
        if (obj[nameToId(col_field)] === 'Null') {
          return '-'
        }
        return obj[nameToId(col_field)]
      }
    }
    if (imageColumns.includes(nameToId(col_field))) {
      columnData.template = (obj, common) => {
        var fieldValue = obj[nameToId(col_field)]
        if (['undefined', undefined].includes(fieldValue)) {
          return '-'
        }
        return fieldValue ? "<div class=\"webix-table-image-container\"><img src=\"" + fieldValue + "\" class=\"webix-table-image\"/></div>" : fieldValue
      }
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
      transformedRow[nameToId(summaryDataColumns[value_n].fieldName)] = rowValue.formattedValue
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
    resizeRow: true,
    // autoheight: true,
    // autowidth: true
  }

  return uiParams;
}

async function drawImageColumnsPopupSection() {
  var checkedWorksheetIds = [...document.querySelectorAll('.worksheet-check-input:checked')].map(
    wsInputNode => wsInputNode.getAttribute('worksheet_id')
  )
  var dashboard = tableau.extensions.dashboardContent.dashboard;
  var availableWorksheets = dashboard.worksheets
  var checkedWs = availableWorksheets.filter((ws) => {
    return checkedWorksheetIds.includes(nameToId(ws.name))
  })

  var choosedWsCols = []
  for (var ws of checkedWs) {
    var wsSummaryData = await ws.getSummaryDataAsync()
    var wsCols = wsColumnsToList(wsSummaryData.columns)
    choosedWsCols = choosedWsCols.concat(wsCols)
  }
  var imageColumnsOverflow = document.getElementById('image-columns-pick-overflow')
  imageColumnsOverflow.innerText = ''
  for (var column of choosedWsCols.getUnique()) {
    var columnFormCheck = document.createElement('div')
    columnFormCheck.classList.add('form-check')

    var columnFormCheckInput = document.createElement('input')
    columnFormCheckInput.classList.add('form-check-input')
    columnFormCheckInput.classList.add('image-column-check-input')
    var wsFormCheckInputAttrs = {
      type: 'checkbox',
      value: '',
      column_id: nameToId(column)
    }
    for (var [n, v] of Object.entries(wsFormCheckInputAttrs)) {
      columnFormCheckInput.setAttribute(n, v)
    }
    if (imageColumns.includes(nameToId(column))) {
      columnFormCheckInput.checked = true
    }

    var columnFormCheckLabel = document.createElement('label')
    columnFormCheckLabel.classList.add('form-check-label')
    columnFormCheckLabel.setAttribute('for', nameToId(column))

    columnFormCheckLabel.innerText = column

    columnFormCheck.appendChild(columnFormCheckInput)
    columnFormCheck.appendChild(columnFormCheckLabel)
    imageColumnsOverflow?.appendChild(columnFormCheck)
  }
}

async function popupConfigureModal() {
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
  var availableWorksheetsSummaryData = await getWsSummaryData(availableWorksheets)
  availableWorksheetsSummaryData.sort(function (a, b) {
    if (a[1].columns.length < b[1].columns.length) { return -1; }
    if (a[1].columns.length > b[1].columns.length) { return 1; }
    return 0;
  })
  console.log('availableWorksheetsSummaryData', availableWorksheetsSummaryData)
  for (var [ws, wsSummary] of availableWorksheetsSummaryData) {
    var wsColumns = wsColumnsToList(wsSummary.columns)
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
    wsFormCheckInput.onclick = async (e) => {
      drawImageColumnsPopupSection()
    }

    var wsFormCheckLabel = document.createElement('label')
    wsFormCheckLabel.classList.add('form-check-label')
    wsFormCheckLabel.setAttribute('for', nameToId(ws.name))

    var columnsBages = wsColumns.map(name => `<span class="badge bg-secondary">${name}</span>`).join(' ')
    wsFormCheckLabel.innerHTML = `${ws.name} ${columnsBages}`

    wsFormCheck.appendChild(wsFormCheckInput)
    wsFormCheck.appendChild(wsFormCheckLabel)
    wsPickOverflow?.appendChild(wsFormCheck)

  }
  var saveButton = document.getElementById('save-settings-button')
  saveButton.onclick = (e) => {
    var checkedWorksheetIds = [...document.querySelectorAll('.worksheet-check-input:checked')].map(
      wsInputNode => wsInputNode.getAttribute('worksheet_id')
    )
    var checkedImageColsIds = [...document.querySelectorAll('.image-column-check-input:checked')].map(
      wsInputNode => wsInputNode.getAttribute('column_id')
    )
    tableau.extensions.settings.set('treetableChoosedWorksheet', JSON.stringify(checkedWorksheetIds))
    tableau.extensions.settings.set('treetableChoosedImageColumns', JSON.stringify(checkedImageColsIds))
    tableau.extensions.settings.saveAsync()

    imageColumns = checkedImageColsIds
    initWorksheet(availableWorksheets.filter((ws) => {
      return checkedWorksheetIds.includes(nameToId(ws.name))
    }))
    configureModal.hide()
  }
  configureModal.show()
  drawImageColumnsPopupSection()
}


$(document).ready(function () {
  tableau.extensions.initializeAsync({ 'configure': popupConfigureModal }).then(async () => {
    var choosedWorksheetsSettings = tableau.extensions.settings.get('treetableChoosedWorksheet')
    imageColumns = tableau.extensions.settings.get('treetableChoosedImageColumns') || []
    if (!choosedWorksheetsSettings) {
      await popupConfigureModal()
    } else {
      var dashboard = tableau.extensions.dashboardContent.dashboard;
      var availableWorksheets = dashboard.worksheets
      var choosedWorksheets = availableWorksheets.filter((ws) => {
        return JSON.parse(choosedWorksheetsSettings).includes(nameToId(ws.name))
      })
      await initWorksheet(choosedWorksheets)
      var dashboardParams = await dashboard.getParametersAsync()
      dashboardParams.map(param => {
        param.addEventListener(tableau.TableauEventType.ParameterChanged, async (e) => {
          await initWorksheet(choosedWorksheets)
        })
      })
    }
  }, function (err) {
    console.error(err)
  });
})

