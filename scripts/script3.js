$.getJSON("https://raw.githubusercontent.com/mayankv03/CoviCare/main/helpline.json", function(helpline){   
        var re = helpline.data;
        buildTable(re)
        function buildTable(data){
            var table = document.getElementById('myTable')
            for (var i = 0; i < data.length; i++){
                var row = `<tr>
                            <td class="text-dark text-semibold " style="text-align: left; vertical-align: middle;">${data[i][0]}</td>
                            <td class="text-dark text-semibold " style="text-align: left; vertical-align: middle;"><a href="tel:${data[i][1]}">${data[i][1]}</a></td>
                        </tr>`
                table.innerHTML += row
            }
        }
})

function myTableSearch() {
    var input, filter, table, tr, td, i, txtValue;
    input = document.getElementById("myTableInput");
    filter = input.value.toUpperCase();
    table = document.getElementById("myTable");
    tr = table.getElementsByTagName("tr");
    for (i = 0; i < tr.length; i++) {
      td = tr[i].getElementsByTagName("td")[0];
      if (td) {
        txtValue = td.textContent || td.innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
          tr[i].style.display = "";
        } else {
          tr[i].style.display = "none";
        }
      }
    }
}

function sortTableStr(n) {
    var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
    table = document.getElementById("myTable");
    switching = true;
    dir = "asc"; 
    while (switching) {
      switching = false;
      rows = table.rows;
      for (i = 1; i < (rows.length - 1); i++) {
        shouldSwitch = false;
        x = rows[i].getElementsByTagName("TD")[n];
        y = rows[i + 1].getElementsByTagName("TD")[n];
        if (dir == "asc") {
          if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
            shouldSwitch= true;
            break;
          }
        } else if (dir == "desc") {
          if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
            shouldSwitch = true;
            break;
          }
        }
      }
      if (shouldSwitch) {
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true;
        switchcount ++;      
      } else {
        if (switchcount == 0 && dir == "asc") {
          dir = "desc";
          switching = true;
        }
      }
    }
  }
  