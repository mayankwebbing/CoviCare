$(document).ready(function(){
    $.getJSON("mp.json", function(hospitalinfoupdate){
            
            var re = hospitalinfoupdate;
            buildTable(re)
            function buildTable(data){
		        var table = document.getElementById('mphospitalinfo')
                for (var i = 0; i < data.length; i++){
                    var row = `<tr>
						        <td class="text-dark text-semibold ">${data[i].district}</td>
                                <td class="text-dark text-semibold ">${data[i].name}</td>
                                <td class="text-dark text-semibold ">${data[i].type}</td>
                                <td class="text-dark text-semibold ">${data[i].contact1}</td>
                                <td class="text-dark text-semibold ">${data[i].contact2}</td>
                                <td class="text-dark text-semibold ">${data[i].contact3}</td>
                            </tr>`
			        table.innerHTML += row
		        }
            }
    })
})

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