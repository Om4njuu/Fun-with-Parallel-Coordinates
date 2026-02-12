//load datasets from JSON files into memory
let cis2012Data; //will hold CIS 2012 rows
let cis2019Data; //will hold CIS 2019 rows
let currentData = null; //currently displayed dataset (used for redraw on resize)

//fetch the 2012 dataset asynchronously
fetch('CIS_2012_dataset.json')
    .then(response => response.json())
    .then(data => {
        cis2012Data = data;
        console.log('CIS 2012 data loaded');
    })
    .catch(error => console.error('Error loading CIS 2012 dataset:', error));

//fetch the 2019 dataset asynchronously
fetch('CIS_2019_dataset.json')
    .then(response => response.json())
    .then(data => {
        cis2019Data = data;
        console.log('CIS 2019 data loaded');
    })
    .catch(error => console.error('Error loading CIS 2019 dataset:', error));

//buttons to choose which dataset to display
document.getElementById('cis2012Button').addEventListener('click', function() {
    //show 2012 data if loaded
    if (cis2012Data) {
        currentData = cis2012Data;
        drawParallelCoordinates(cis2012Data);
    } else {
        alert('CIS 2012 dataset is not loaded yet.');
    }
});

document.getElementById('cis2019Button').addEventListener('click', function() {
    //show 2019 data if loaded
    if (cis2019Data) {
        currentData = cis2019Data;
        drawParallelCoordinates(cis2019Data);
    } else {
        alert('CIS 2019 dataset is not loaded yet.');
    }
});

//main function to draw parallel coordinates chart for provided `data`
function drawParallelCoordinates(data) {
    //clear previous chart content
    d3.select('#chart').html('');

    //margins and responsive sizing
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const containerWidth = document.getElementById('chart').clientWidth || 900; //fallback
    const width = containerWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    //x: position of axes; y: mapping per-dimension; isNumeric: type map
    const x = d3.scalePoint().range([0, width]).padding(1),
          y = {},
          isNumeric = {};

    //line generator for polylines
    const line = d3.line();

    //create SVG and main group
    const svg = d3.select('#chart')
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    //derive axis names from first row keys
    const dimensions = Object.keys(data[0]);
    console.log('Dimensions:', dimensions);
    x.domain(dimensions);

    //prepare scales for each dimension (numeric -> linear, others -> point)
    dimensions.forEach(function(dim) {
        const vals = data.map(d => d[dim]).filter(v => v !== undefined && v !== null);
        const allNumeric = vals.length > 0 && vals.every(v => !isNaN(+v));
        isNumeric[dim] = allNumeric;

        if (allNumeric) {
            const extent = d3.extent(vals, v => +v);
            if (extent[0] === extent[1]) extent[0] = extent[0] - 1; //avoid zero range
            y[dim] = d3.scaleLinear().domain(extent).range([height, 0]);
        } else {
            const unique = Array.from(new Set(vals.map(v => String(v))));
            y[dim] = d3.scalePoint().domain(unique).range([height, 0]).padding(0.5);
        }
    });

    //draw polylines for each data row
    const linesG = svg.append('g').attr('class', 'lines');
    linesG.selectAll('.line')
        .data(data)
      .enter().append('path')
        .attr('class', 'line')
        .attr('d', function(row) {
            return line(dimensions.map(function(p) {
                const v = isNumeric[p] ? +row[p] : String(row[p]);
                return [x(p), y[p](v)];
            }));
        })
        .style('stroke', 'rgba(0,0,0,0.6)')
        .style('stroke-width', 1)
        .style('fill', 'none');

    //draw axes and axis labels on top
    const dimensionG = svg.selectAll('.dimension')
        .data(dimensions)
      .enter().append('g')
        .attr('class', 'dimension')
        .attr('transform', d => `translate(${x(d)})`);

    dimensionG.each(function(d) {
        const g = d3.select(this);
        if (isNumeric[d]) {
            const extent = y[d].domain();
            const ticks = d3.ticks(extent[0], extent[1], 5);
            g.call(d3.axisLeft(y[d]).tickValues(ticks));
        } else {
            const domain = y[d].domain();
            g.call(d3.axisLeft(y[d]).tickValues(domain));
        }

        //axis title
        g.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', -10)
            .text(d);
    });

    console.log('Chart rendered with', data.length, 'rows and', dimensions.length, 'axes');
}

//redraw chart on window resize (debounced)
let _resizeTimeout = null;
window.addEventListener('resize', function() {
    if (_resizeTimeout) clearTimeout(_resizeTimeout);
    _resizeTimeout = setTimeout(function() {
        if (currentData) drawParallelCoordinates(currentData);
    }, 200);
});
