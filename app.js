document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage["currentTable"]) localStorage.setItem('currentTable', "Unsaved");
    if (!localStorage["activeTables"]) localStorage.setItem('activeTables', JSON.stringify([localStorage['currentTable']]));
    let budgetData = JSON.parse(localStorage.getItem(localStorage["currentTable"]) || '[]');
    let selectedRow = null;
    const reservedNames = ['Unsaved', 'currentTable', 'activeTables'];
    let categoryOptions = [];

    const date = document.getElementById("date-input");
    const cost = document.getElementById("cost-input");
    const category = document.getElementById("category-input");
    const description = document.getElementById("description-input");
    const currentTableBody = document.querySelector("#write-off-table tbody");
    const activeTables = document.getElementById("active-tables");
    const totalsTableBody = document.querySelector("#totals-table tbody");
    const fileChooser = document.getElementById("file-chooser");
    const rrLabel = document.getElementById("remove-record-label");
    const raLabel = document.getElementById("record-added");
    const categoryList = document.getElementById("categories");
    const overlay = document.getElementById("overlay");
    const importFileChooser = document.getElementById("import-file-chooser");
    const importTableHead = document.querySelector("#import-table thead");
    const importTableBody = document.querySelector("#import-table tbody");

    document.getElementById("remove-record").addEventListener("click", deleteRecord);
    document.getElementById("save-file").addEventListener("click", exportCSV);
    document.getElementById("new-file").addEventListener("click", newFile);
    document.getElementById("open-file").addEventListener("click", openFile);
    document.getElementById("import-file").addEventListener('click', () => { importFileChooser.click() });
    document.getElementById("close-import").addEventListener('click', closeImportFile);
    document.getElementById("accept-import").addEventListener('click', acceptImport);

    importFileChooser.addEventListener('change', (e) => { importFile(e) });

    fileChooser.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            console.log("reader loaded");
            const text = evt.target.result;
            const rows = text.split('\n')
                .map(r => r.trim())
                .filter(r => r.length > 0)
                .map(r => r.split(',').map(c => c.replace(/^"|$/g, '').trim()));
            if (!rows.length) return alert("CSV is empty or invalid.");

            const headers = rows.shift();
            if (headers.length < 4) return alert("CSV should have 4 columns: Date, Cost, Category, Description");

            console.log("file accepted");

            localStorage["currentTable"] = file.name.replace(/\.[^/.]+$/, "");

            budgetData = rows;
            localStorage.setItem(localStorage["currentTable"], JSON.stringify(budgetData));
            renderTable();
            renderTotals();
        }
        reader.readAsText(file);
    });


    document.getElementById("input-form").addEventListener("submit", function (e) {
        e.preventDefault();

        const row = [date.value, Number(cost.value).toFixed(2), category.value, description.value]
        budgetData.unshift(row);
        localStorage.setItem(localStorage["currentTable"], JSON.stringify(budgetData));
        cost.value = "";

        raLabel.style.transition = "none";
        raLabel.textContent = row.join(', ');
        raLabel.classList.remove("hide");
        setTimeout(() => {
            raLabel.style.transition = "opacity 1s ease-out";
            raLabel.classList.add("hide");
        }, 2000); // start fading after 2 seconds

        let newValue = category.value.trim().replace(/\b\w/g, c => c.toUpperCase());
        if (!categoryOptions.some(cat => cat.toLowerCase() === newValue.toLowerCase())) {
            categoryOptions.push(newValue);
            updateCategoryOptions();
        }

        renderTable();
        renderTotals();

        cost.focus();
    });

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (insideQuotes && line[i + 1] === '"') {
                    current += '"'; // escaped quote
                    i++;
                } else {
                    insideQuotes = !insideQuotes; // toggle quoted mode
                }
            } else if (char === ',' && !insideQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    function acceptImport() {
        let rowOrder = [];
        const headers = importTableHead.querySelectorAll('thead th');
        ["Date", "Cost", "Category", "Description"].forEach(item => {
            rowOrder.push(Array.from(headers).findIndex(h => {
                const select = h.querySelector('select');
                return select && select.value.trim().toLowerCase() === item.trim().toLowerCase();
            }));
        });
        Array.from(importTableBody.children).forEach(row => {
            if (row.children[0].querySelector('input').checked) {
                let rowData = [];
                rowOrder.forEach(i => {
                    let data = i > 0 ? row.children[i].textContent : "";
                    rowData.push(data);
                });
                budgetData.unshift(rowData);
            }
        });

        localStorage.setItem(localStorage["currentTable"], JSON.stringify(budgetData));

        closeImportFile();
        renderTable();
        renderTotals();
    }

    function closeImportFile() {
        overlay.classList.add("d-none")
        importFileChooser.value = '';
    }

    function importFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            console.log("reader loaded");
            const text = evt.target.result;
            const rows = text.split('\n')
                .filter(r => r.trim().length > 0)
                .map(parseCSVLine);
            if (!rows.length) return alert("CSV is empty or invalid.");

            const headers = rows.shift();

            importTableHead.innerHTML = '';
            const selectAll = document.createElement('input')
            selectAll.type = 'checkbox';
            selectAll.id = "select-all";
            const tr1 = document.createElement('th');
            tr1.appendChild(selectAll);
            importTableHead.appendChild(tr1);
            headers.forEach((h, index) => {
                const header = document.createElement('th');
                const select = document.createElement('select');
                [h, "Date", "Cost", "Category", "Description"].forEach(i => {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = i;
                    select.appendChild(option);
                });
                select.addEventListener('change', () => {
                    const rows = importTableBody.querySelectorAll("tr");
                    rows.forEach(row => {
                        const cell = row.cells[index + 1];
                        if (cell) {
                            if (["Date", "Cost", "Category", "Description"].includes(select.value)) {
                                cell.classList.add('selected');
                            }
                            else cell.classList.remove('selected');
                        }
                    })
                });
                header.appendChild(select);
                //header.textContent = h;
                importTableHead.appendChild(header);
            });

            importTableBody.innerHTML = '';
            rows.forEach(r => {
                const tr = document.createElement('tr');
                const td1 = document.createElement('td');
                const selectRow = document.createElement('input')
                selectRow.type = 'checkbox';
                selectRow.classList.add('selectRow');
                td1.appendChild(selectRow);
                tr.appendChild(td1);
                r.forEach(i => {
                    const td = document.createElement('td');
                    td.textContent = i;
                    tr.appendChild(td);
                });
                importTableBody.appendChild(tr);
            });

            let cell = null;
            let row = null;
            let originalValue = ""; // store value before editing

            importTableBody.addEventListener('dblclick', e => {
                cell = e.target.closest('td');
                row = e.target.closest('tr');
                if (!cell || row.parentNode.tagName === 'THEAD') return;
                originalValue = cell.textContent; // save original value
                focusCell();
            });

            importTableBody.addEventListener('keydown', evt => {
                if (!cell) return;

                if (evt.key === 'Enter' && !evt.shiftKey) {
                    evt.preventDefault();
                    commitEdit(); // save value
                    moveToCell(cell, 'down');
                } else if (evt.key === 'Enter' && evt.shiftKey) {
                    evt.preventDefault();
                    commitEdit(); // save value
                    moveToCell(cell, 'up');
                } else if (evt.key === 'Tab' && !evt.shiftKey) {
                    evt.preventDefault();
                    commitEdit(); // save value
                    moveToCell(cell, 'right');
                } else if (evt.key === 'Tab' && evt.shiftKey) {
                    evt.preventDefault();
                    commitEdit(); // save value
                    moveToCell(cell, 'left');
                } else if (evt.key === 'Escape') {
                    evt.preventDefault();
                    revertEdit(); // restore original
                }
            });

            function focusCell() {
                cell.contentEditable = true;

                // store value in case of revert
                originalValue = cell.textContent;

                const range = document.createRange();
                range.selectNodeContents(cell);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);

                // scroll into view if needed
                cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

                cell.addEventListener('blur', () => {
                    commitEdit(); // commit if user clicks away
                    cell.contentEditable = false;
                    window.getSelection().removeAllRanges();
                }, { once: true, capture: true });
            }

            function commitEdit() {
                // could add validation or saving logic here later
                originalValue = cell.textContent;
            }

            function revertEdit() {
                cell.textContent = originalValue;
                cell.blur(); // trigger blur to exit editing
            }

            function moveToCell(current, direction) {
                const row = current.parentElement;
                const cellIndex = current.cellIndex;
                let nextCell;

                if (direction === 'right') {
                    nextCell = row.cells[cellIndex + 1] || row.nextElementSibling?.cells[1];
                } else if (direction === 'down') {
                    const nextRow = row.nextElementSibling;
                    if (nextRow) nextCell = nextRow.cells[cellIndex];
                } else if (direction === "up") {
                    const prevRow = row.previousElementSibling;
                    if (prevRow) nextCell = prevRow.cells[cellIndex];
                } else if (direction === "left") {
                    nextCell = row.cells[cellIndex - 1] || row.previousElementSibling?.cells[1];
                }

                if (nextCell) {
                    cell.blur(); // ensure we leave edit mode properly
                    cell = nextCell;
                    focusCell();
                }
            }

            selectAll.addEventListener("change", e => {
                const checked = e.target.checked;
                importTableBody.querySelectorAll(".selectRow").forEach(cb => {
                    cb.checked = checked;
                });
            });

        }
        reader.readAsText(file);
        overlay.classList.remove("d-none");
    }

    function updatedActiveTables() {
        if (localStorage["activeTables"]) {
            console.log(localStorage["activeTables"]);
            activeTables.innerHTML = '';
            let tables = JSON.parse(localStorage.getItem('activeTables')) || [];
            const aTable = localStorage["currentTable"];
            tables.forEach(table => {
                console.log("atable", aTable);
                console.log("table", table);
                const div = document.createElement('div');
                div.classList.add("d-flex", "flex-row", "gap-3", "items-center");
                const header = document.createElement('span');
                header.classList.add("fs-xl", "fw-bold", "flex-grow")
                if (table == aTable) div.classList.add("active");
                else {
                    div.addEventListener('click', () => {
                        localStorage["currentTable"] = table;
                        budgetData = JSON.parse(localStorage.getItem(localStorage["currentTable"]) || '[]');
                        updatedActiveTables();
                        renderTable();
                        renderTotals();
                    });
                }
                header.textContent = table;
                const close = document.createElement('button');
                close.classList.add("h-4", "p-1", "d-flex", "justify-center", "items-center", "ratio-1-1")
                close.textContent = 'x';
                close.addEventListener('click', e => {
                    e.stopPropagation();
                    tables = tables.filter(item => item !== table);
                    localStorage["activeTables"] = JSON.stringify(tables);
                    if (aTable === table) {
                        localStorage['currentTable'] = tables[0];
                        renderTable();
                        renderTotals();
                    }
                    updatedActiveTables();
                });
                div.appendChild(header);
                div.appendChild(close);
                activeTables.appendChild(div);
            });
        }
    }

    function updateCategoryOptions() {
        categoryList.innerHTML = '';
        categoryOptions.sort().forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            categoryList.appendChild(option);
        });
    }

    function deleteRecord() {
        if (!selectedRow) return alert("No Row Selected");

        const index = Array.from(currentTableBody.children).indexOf(selectedRow);
        if (confirm('Delete this row?')) {
            budgetData.splice(index, 1);
            localStorage.setItem(localStorage["currentTable"], JSON.stringify(budgetData));
            selectedRow.remove();
            selectedRow = null;
            rrLabel.classList.add('hide');
        }

        renderTotals();
    }

    function initTableSort() {
        document.querySelectorAll('#write-off-table th').forEach(th => {
            th.addEventListener('click', () => {
                const ascending = th.classList.toggle('asc');
                const headers = ["Date", "Cost", "Category", "Description"];
                const index = headers.indexOf(th.dataset.key);
                if (index > 1) {
                    budgetData.sort((a, b) =>
                        ascending
                            ? a[index].localeCompare(b[index], undefined, { sensitivity: 'base' })
                            : b[index].localeCompare(a[index], undefined, { sensitivity: 'base' })
                    );
                }
                else if (index === 1) {
                    budgetData.sort((a, b) => {
                        const numA = Number(a[index]);
                        const numB = Number(b[index]);

                        return ascending ? numA - numB : numB - numA;
                    });
                }
                else {
                    budgetData.sort((a, b) => {
                        const dateA = new Date(a[index]);
                        const dateB = new Date(b[index]);

                        return ascending ? dateA - dateB : dateB - dateA;
                    });
                }
                document.querySelectorAll('#write-off-table th').forEach(th2 => {
                    const c = th2.querySelector('.carrot');
                    c.textContent = '';
                });
                const carrot = th.querySelector('.carrot');
                carrot.textContent = ascending ? '\u25B2' : '\u25BC';
                localStorage.setItem(localStorage["currentTable"], JSON.stringify(budgetData));
                renderTable();
            });
        });
    }

    function renderTotals() {
        totalsTableBody.innerHTML = '';
        let totals = {};

        budgetData.forEach(row => {
            const recordCost = parseFloat(row[1]) || 0;
            const recordCategory = row[2].trim().replace(/\b\w/g, c => c.toUpperCase());
            if (!totals[recordCategory]) totals[recordCategory] = 0;
            totals[recordCategory] += recordCost;
        });

        const colors = [
            "#C1BFA8", // light beige
            "#A4785D", // warm brown
            "#7B5E4A", // deeper brown
            "#D9D2B6", // pale sand
            "#E0A97B", // soft orange/tan
            "#5C5146", // muted gray-brown
            "#F2EAD3", // off-white cream
            "#B07B5A"  // terracotta-ish accent
        ];
        const total = Object.values(totals).reduce((a, b) => a + b, 0);

        let offset = 0;
        const svg = document.getElementById("donutChart");
        //const legend = document.getElementById("legend");

        const sortedData = Object.keys(totals)
            .sort()
            .reduce((obj, key) => {
                obj[key] = totals[key];
                return obj;
            }, {});

        Object.entries(sortedData).forEach(([category, value], i) => {
            const percent = (value / total) * 100;

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", 21);
            circle.setAttribute("cy", 21);
            circle.setAttribute("r", 15.9155);
            circle.setAttribute("fill", "transparent");
            circle.setAttribute("stroke", colors[i % colors.length]);
            circle.setAttribute("stroke-width", 20);
            circle.setAttribute("stroke-dasharray", `${percent} ${100 - percent}`);
            circle.setAttribute("stroke-dashoffset", offset);

            svg.appendChild(circle);
            offset -= percent;

            // Add a row to the table legend
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="background:${colors[i % colors.length]}; width:20px;"></td>
                <td>${category}:</td>
                <td>$${value.toFixed(2)}</td>
                <td>${percent.toFixed(1)}%</td>
                `;
            totalsTableBody.appendChild(tr);
        });
    }

    function renderTable() {
        //currentTableLabel.textContent = localStorage["currentTable"];
        currentTableBody.innerHTML = "";
        budgetData.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            });
            let newValue = row[2].trim().replace(/\b\w/g, c => c.toUpperCase());
            if (!categoryOptions.some(cat => cat.toLowerCase() === newValue.toLowerCase())) {
                categoryOptions.push(newValue);
            }
            let clickTimer = null;
            const delay = 250;
            tr.addEventListener('click', (event) => {
                if (clickTimer) {
                    // second click happened before timer expired → double-click action
                    clearTimeout(clickTimer);
                    clickTimer = null;
                    const td = event.target.closest("td");
                    focusTD(td, tr);
                } else {
                    // first click → start timer
                    clickTimer = setTimeout(() => {
                        selectRow(tr, row);
                        clickTimer = null;
                    }, delay);
                }
            });
            currentTableBody.appendChild(tr);
        });

        function focusTD(cell, row) {
            let originalValue = cell.textContent;

            cell.contentEditable = true;

            // select all text
            const range = document.createRange();
            range.selectNodeContents(cell);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            // scroll into view if needed
            cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

            // define key handler
            const handleKey = (e) => {
                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        cell.blur();
                        break;
                    case 'Escape':
                        e.preventDefault();
                        cell.textContent = originalValue;
                        cell.blur(); // triggers blur handler below
                        break;
                }
            };

            // attach listener
            cell.addEventListener('keydown', handleKey);

            // remove everything on blur
            cell.addEventListener('blur', () => {
                cell.contentEditable = false;
                const rowIndex = Array.from(currentTableBody.children).indexOf(row);
                const colIndex = Array.from(row.children).indexOf(cell);
                budgetData[rowIndex][colIndex] = cell.textContent;
                localStorage.setItem(localStorage["currentTable"], JSON.stringify(budgetData));
                renderTotals();
                window.getSelection().removeAllRanges();
                cell.removeEventListener('keydown', handleKey); // remove the key listener
            }, { once: true, capture: true });
        }


        function selectRow(tr, row) {
            if (selectedRow) selectedRow.classList.remove('selected');
            tr.classList.add('selected');
            let rowDate = row[0];
            if (rowDate.includes('/')) {
                const [month, day, year] = rowDate.split('/');
                if (!month || !day || !year) rowDate = null;
                else rowDate = `${year}-${month}-${day}`;
            }
            selectedRow = tr;
            date.value = rowDate;
            cost.value = row[1];
            category.value = row[2];
            description.value = row[3]
            rrLabel.classList.remove('hide');
            rrLabel.textContent = row.join(', ');
        }

        updateCategoryOptions();

        selectedRow = null;
        rrLabel.classList.add('hide');
    }

    function exportCSV() {
        if (!budgetData.length) return alert("No data to export");

        const headers = ["Date", "Cost", "Category", "Description"];
        const csvRows = budgetData.map(row =>
            row.map(cell => `"${String(cell).replace(/"/g, '""')}`).join(',')
        );
        const csvContent = [headers.join(','), ...csvRows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);

        a.download = `${localStorage["currentTable"]}`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function newFile() {
        let name = prompt("Enter a new tablename");
        if (!name) return;

        if (reservedNames.some(r => name.toLowerCase() == r.toLocaleLowerCase())) {
            alert(`"${name}" is a reserved name. Please choose another`);
            return;
        }

        if (localStorage.getItem(name)) {
            const overwrite = confirm("A dataset with that name already exists. Overwright?");
            if (!overwrite) return;
        }

        localStorage["currentTable"] = name;
        budgetData = [];
        renderTable();
        renderTotals();
    }

    function openFile() {
        let datasets = Object.keys(localStorage)
            .filter(key => !reservedNames.includes(key));
        const choice = prompt(
            "Choose a dataset to open:\n" + datasets.map((n, i) => `${i + 1}: ${n}`).join('\n') + "\nOr cancel to upload a CSV file."
        );

        const index = parseInt(choice) - 1;
        if (!isNaN(index) && index >= 0 && index < datasets.length) {
            const key = datasets[index];
            budgetData = JSON.parse(localStorage.getItem(key));
            localStorage["currentTable"] = key;
            addActiveTable(key);
            renderTable();
            renderTotals();
            updatedActiveTables();
            return;
        }
        fileChooser.click();
    }

    function addActiveTable(newTable) {
        let tables = JSON.parse(localStorage["activeTables"]);
        if (!tables.includes(newTable)) {
            tables.push(newTable);
            localStorage["activeTables"] = JSON.stringify(tables);
        }
    }

    renderTable();
    renderTotals();
    updatedActiveTables();
    initTableSort();
});