// $.getJSON("https://raw.githubusercontent.com/mayankv03/CoviCare/main/mp.json", function(hospitalinfoupdate){   
//         var re = hospitalinfoupdate;
//         buildTable(re)
//         function buildTable(data){
//             var table = document.getElementById('mphospitalinfo')
//             for (var i = 0; i < data.length; i++){
//                 var row = `<tr>
// 						      <td class="text-dark text-semibold " style="text-align: center; vertical-align: middle;">${data[i].district}</td>
//                             <td class="text-dark text-semibold " style="vertical-align: middle;">${data[i].name}</td>
//                             <td class="text-dark text-semibold " style="text-align: center; vertical-align: middle;">${data[i].type}</td>
//                             <td class="text-dark text-semibold " style="text-align: center; vertical-align: middle;">${data[i].contact1[0]} <br><a href="tel:${data[i].contact1[1]}">${data[i].contact1[1]}</a></td>
//                             <td class="text-dark text-semibold " style="text-align: center; vertical-align: middle;">${data[i].contact2[0]} <br><a href="tel:${data[i].contact2[1]}">${data[i].contact2[1]}</a></td>
//                             <td class="text-dark text-semibold " style="text-align: center; vertical-align: middle;">${data[i].contact3[0]} <br><a href="tel:${data[i].contact3[1]}">${data[i].contact3[1]}</a></td>
//                         </tr>`
//                 table.innerHTML += row
//             }
//         }
// })

function myTableSearch() {
    // Declare variables
    var input, filter, table, tr, td, i, txtValue;
    input = document.getElementById("myTableInput");
    filter = input.value.toUpperCase();
    table = document.getElementById("mphospitalinfo");
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

$('#mphospitalinfo').dataTable( {
  "pageLength": 10
} );
$(document).ready(function() { 
  $('#example').DataTable( { 
    dom: 'Bfrtip', 
    lengthMenu: [ 
      [ 10, 25, 50, -1 ], 
      [ '10 rows', '25 rows', '50 rows', 'Show all' ] ], 
      buttons: [ 'pageLength' ] 
  } ); 
} );