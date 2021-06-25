$.getJSON("https://api.covid19india.org/data.json", function(data){

    var today = data.cases_time_series[data.cases_time_series.length - 1];
    var yesterday = data.cases_time_series[data.cases_time_series.length - 2];
    $(".todayDate").append(today.date);
    $(".yesterdayDate").append(yesterday.date);
    $(".todayCases").append(today.dailyconfirmed);
    $(".todayRecovered").append(today.dailyrecovered);
    $(".todayActive").append(today.dailyconfirmed - today.dailydeceased - today.dailyrecovered );
    $(".todayDeaths").append(today.dailydeceased);

    var increment = {
        total: function () {
            return ( ( ( today.dailyconfirmed - yesterday.dailyconfirmed ) / yesterday.dailyconfirmed ) * 100).toFixed(2);
        },
        recovered: function () {
            return ( ( ( today.dailyrecovered - yesterday.dailyrecovered ) / yesterday.dailyrecovered ) * 100).toFixed(2);
        },
        active: function () {
            var todayActi= (today.dailyconfirmed - today.dailydeceased - today.dailyrecovered );
            var yesterdayActi = (yesterday.dailyconfirmed -  yesterday.dailydeceased - today.dailyrecovered );
            return ( ( ( todayActi - yesterdayActi ) / yesterdayActi ) * 100).toFixed(2);
        },
        deceased: function () {
            return ( ( ( today.dailydeceased - yesterday.dailydeceased ) / yesterday.dailydeceased ) * 100).toFixed(2);
        }
    }

    var increased = "Increased by ";
    var decreased = "Decreased by ";
    if (increment.total() > 0) {
        // $('<i class="fa fa-arrow-up"></i>').appendTo('.incdec1');
        $( "span" ).addClass(function( test, currentClass ) {
            var addedClass;
            if ( currentClass === "incdec1" ) {
                addedClass = "stats-small__percentage stats-small__percentage--increase";
            }
            return addedClass;
            });
        $(".incdec1").append(increased,Math.abs(increment.total()),"%");
    } else {
        // $('<i class="fa fa-arrow-down"></i>').appendTo('.incdec1');
        $( "span" ).addClass(function( test, currentClass ) {
            var addedClass;
            if ( currentClass === "incdec1" ) {
                addedClass = "stats-small__percentage stats-small__percentage--decrease";
            }
            return addedClass;
            });
        $(".incdec1").append(decreased,Math.abs(increment.total()),"%");
    }
    if (increment.recovered() > 0) {
        // $('<i class="fa fa-arrow-up"></i>').appendTo('.incdec2');
        $( "span" ).addClass(function( test, currentClass ) {
            var addedClass;
            if ( currentClass === "incdec2" ) {
                addedClass = "stats-small__percentage stats-small__percentage--increase";
            }
            return addedClass;
            });
        $(".incdec2").append(increased,Math.abs(increment.recovered()),"%");
    } else {
        // $('<i class="fa fa-arrow-down"></i>').appendTo('.incdec2');
        $( "span" ).addClass(function( test, currentClass ) {
            var addedClass;
            if ( currentClass === "incdec2" ) {
                addedClass = "stats-small__percentage stats-small__percentage--decrease";
            }
            return addedClass;
            });
        $(".incdec2").append(decreased,Math.abs(increment.recovered()),"%");
    }
    if (increment.active() > 0) {
        // $('<i class="fa fa-arrow-up"></i>').appendTo('.incdec3');
        $( "span" ).addClass(function( test, currentClass ) {
            var addedClass;
            if ( currentClass === "incdec3" ) {
                addedClass = "stats-small__percentage stats-small__percentage--increase";
            }
            return addedClass;
            });
        $(".incdec3").append(increased,Math.abs(increment.active()),"%");
    } else {
        // $('<i class="fa fa-arrow-down"></i>').appendTo('.incdec3');
        $( "span" ).addClass(function( test, currentClass ) {
            var addedClass;
            if ( currentClass === "incdec3" ) {
                addedClass = "stats-small__percentage stats-small__percentage--decrease";
            }
            return addedClass;
            });
        $(".incdec3").append(decreased,Math.abs(increment.active()),"%");
    }
    if (increment.deceased() > 0) {
        // $('<i class="fa fa-arrow-up"></i>').appendTo('.incdec4');
        $( "span" ).addClass(function( test, currentClass ) {
            var addedClass;
            if ( currentClass === "incdec4" ) {
                addedClass = "stats-small__percentage stats-small__percentage--increase";
            }
            return addedClass;
            });
        $(".incdec4").append(increased,Math.abs(increment.deceased()),"%");
    } else {
        // $('<i class="fa fa-arrow-down"></i>').appendTo('.incdec4');
        $( "span" ).addClass(function( test, currentClass ) {
            var addedClass;
            if ( currentClass === "incdec4" ) {
                addedClass = "stats-small__percentage stats-small__percentage--decrease";
            }
            return addedClass;
            });
        $(".incdec4").append(decreased,Math.abs(increment.deceased()),"%");
    }
})

$.getJSON("https://api.rootnet.in/covid19-in/stats/latest", function(latest){

    var total = latest.data;
    var regional = total.regional;
    $(".totalCases").append(total.summary.total);
    $(".totalRecovered").append(total.summary.discharged);
    $(".totalActive").append(total.summary.total - (total.summary.discharged - total.summary.deaths));
    $(".totalDeaths").append(total.summary.deaths);
})

$.getJSON("https://api.rootnet.in/covid19-in/stats/latest", function(latestData){
            
            var re = latestData.data.regional;
            buildTable(re)
            function buildTable(data){
		        var table = document.getElementById('myTable')
                for (var i = 0; i < data.length; i++){
                    var aa = data[i].totalConfirmed - data[i].discharged - data[i].deaths;
                    var row = `<tr>
						        <td class="text-dark text-semibold ">${data[i].loc}</td>
                                <td class="text-danger text-semibold ">${data[i].totalConfirmed}</td>
                                <td class="text-success text-semibold ">${data[i].discharged}</td>
                                <td class="text-info text-semibold ">${aa}</td>
                                <td class="text-secondary text-semibold ">${data[i].deaths}</td>
                            </tr>`
			        table.innerHTML += row
		        }
            }
})

function myTableSearch() {
  // Declare variables
  var input, filter, table, tr, td, i, txtValue;
  input = document.getElementById("myTableInput");
  filter = input.value.toUpperCase();
  table = document.getElementById("myTable");
  tr = table.getElementsByTagName("tr");

  // Loop through all table rows, and hide those who don't match the search query
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
  //Set the sorting direction to ascending:
  dir = "asc"; 
  //Make a loop that will continue until no switching has been done:
  while (switching) {
    //start by saying: no switching is done:
    switching = false;
    rows = table.rows;
    //Loop through all table rows (except the first, which contains table headers):
    for (i = 1; i < (rows.length - 1); i++) {
      //start by saying there should be no switching:
      shouldSwitch = false;
      //Get the two elements you want to compare,      one from current row and one from the next:
      x = rows[i].getElementsByTagName("TD")[n];
      y = rows[i + 1].getElementsByTagName("TD")[n];
      //check if the two rows should switch place,      based on the direction, asc or desc:
      if (dir == "asc") {
        if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
          //if so, mark as a switch and break the loop:
          shouldSwitch= true;
          break;
        }
      } else if (dir == "desc") {
        if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
          //if so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      //if a switch has been marked, make the switch      and mark that a switch has been done:
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      //Each time a switch is done, increase this count by 1:
      switchcount ++;      
    } else {
      //If no switching has been done AND the direction is "asc",      set the direction to "desc" and run the while loop again.
      if (switchcount == 0 && dir == "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }
}

// function sortTableNo(n) {
//     var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
//     table = document.getElementById("myTable");
//     switching = true;
//     //Set the sorting direction to ascending:
//     dir = "asc";
//     /*Make a loop that will continue until
//     no switching has been done:*/
//     while (switching) {
//         //start by saying: no switching is done:
//         switching = false;
//         rows = table.rows;
//         /*Loop through all table rows (except the
//         first, which contains table headers):*/
//         for (i = 1; i < (rows.length - 1); i++) {
//             //start by saying there should be no switching:
//             shouldSwitch = false;
//             /*Get the two elements you want to compare,
//             one from current row and one from the next:*/
//             x = rows[i].getElementsByTagName("TD")[n];
//             y = rows[i + 1].getElementsByTagName("TD")[n];
//             //check if the two rows should switch place:
//             if (dir == "asc") {
//                 if (Number(x.innerHTML) > Number(y.innerHTML)) {
//                     //if so, mark as a switch and break the loop:
//                     shouldSwitch = true;
//                     break;
//                 }
//             }
//             else if (dir == "desc") {
//                     if (Number(x.innerHTML) < Number(y.innerHTML)) {
//                     //if so, mark as a switch and break the loop:
//                     shouldSwitch = true;
//                     break;
//                 }
//             }
//         }
//         if (shouldSwitch) {
//         /*If a switch has been marked, make the switch
//         and mark that a switch has been done:*/
//         rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
//         switching = true;
//         //Each time a switch is done, increase this count by 1:
//         switchcount ++; 
//         }
//         else {
//         /*If no switching has been done AND the direction is "asc",
//         set the direction to "desc" and run the while loop again.*/
//         if (switchcount == 0 && dir == "asc") {
//             dir = "desc";
//             switching = true;
//         }
//         }
//     }
// }
