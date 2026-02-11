//load the datasets
let cis2012Data;
let cis2019Data;

//load CIS 2012 dataset
fetch('/path/to/CIS_2012_dataset.json')
    .then(response => response.json())
    .then(data => {
        cis2012Data = data;
    });

//load CIS 2019 dataset
fetch('/path/to/CIS_2019_dataset.json')
    .then(response => response.json())
    .then(data => {
        cis2019Data = data;
    });

//button listeners for each dataset
document.getElementById('cis2012Button').addEventListener('click', function() {
    if (cis2012Data) {
        drawParallelCoordinates(cis2012Data);
    } else {
        alert("CIS 2012 dataset is not loaded yet.");
    }
});

document.getElementById('cis2019Button').addEventListener('click', function() {
    if (cis2019Data) {
        drawParallelCoordinates(cis2019Data);
    } else {
        alert("CIS 2019 dataset is not loaded yet.");
    }
});

//draw parallel coordinates
function drawParallelCoordinates(data) {
    d3.select("#chart").html(""); //clear the chart before redrawing

    const margin = { top: 20, right: 20, bottom: 40, left: 50 },
          width = 900 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    const x = d3.scalePoint().range([0, width]).padding(1),
          y = {};

    const line = d3.line(),
          axis = d3.axisLeft();

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //extract the list of dimensions and set up scales
    const dimensions = d3.keys(data[0]).filter(d => d !== "gender"); //assuming gender is a nominal variable
    x.domain(dimensions);

    dimensions.forEach(function(d) {
        y[d] = d3.scaleLinear()
            .domain(d3.extent(data, function(p) { return +p[d]; }))
            .range([height, 0]);
    });

    //draw the lines for each data entry
    svg.selectAll(".dimension")
        .data(dimensions)
      .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
      .each(function(d) {
          d3.select(this).call(axis.scale(y[d]));
      });

    svg.selectAll(".line")
        .data(data)
      .enter().append("path")
        .attr("class", "line")
        .attr("d", function(d) {
            return line(dimensions.map(function(p) { return [x(p), y[p](d[p])]; }));
        });
}