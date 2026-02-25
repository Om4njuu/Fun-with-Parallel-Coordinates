//load datasets from JSON files into memory
let cis2012Data; //will hold CIS 2012 rows
let cis2019Data; //will hold CIS 2019 rows
let currentData = null; //currently displayed dataset (used for redraw on resize)

//tooltip for showing row details on hover
const tooltip = d3.select('body').append('div')
    .attr('id', 'pc-tooltip')
    .attr('class', 'pc-tooltip');

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

//clear selection button
document.getElementById('clearSelectionButton').addEventListener('click', function() {
    const svgSel = d3.select('#chart svg');
    if (!svgSel.empty()) {
        svgSel.selectAll('.line').classed('selected', false).classed('faint', false).classed('hovered', false);
        svgSel.selectAll('.brush-rect').classed('visible', false);
        if (svgSel.node()) svgSel.node()._brushInitialSelected = null;
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
        .each(function(row) {
            //save computed points on DOM element for later hit-testing during brushing
            const pts = dimensions.map(function(p) {
                const v = isNumeric[p] ? +row[p] : String(row[p]);
                return [x(p), y[p](v)];
            });
            this._pc_points = pts;
            //keep original data row for recomputing path on resize
            this._pc_row = row;
        })
        .on('mouseover', function(event, row) {
            d3.select(this).raise().classed('hovered', true);

            //build tooltip content
            const html = dimensions.map(d => `<div><strong>${d}</strong>: ${row[d] == null ? '' : row[d]}</div>`).join('');
            tooltip.html(html)
                .classed('visible', true)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY + 10) + 'px');
        })
        .on('mousemove', function(event, row) {
            tooltip.style('left', (event.pageX + 10) + 'px')
                   .style('top', (event.pageY + 10) + 'px');
        })
        .on('mouseout', function(event, row) {
            d3.select(this).classed('hovered', false);
            tooltip.classed('visible', false);
        });

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

    // store current chart state to allow non-destructive resize (no full redraw)
    const chartNode = d3.select('#chart').node();
    chartNode._pc = {
        x: x,
        y: y,
        dimensions: dimensions,
        line: line,
        margin: margin,
        width: width,
        height: height,
        isNumeric: isNumeric,
        svgGroup: svg
    };

    //overlay to capture pointer events
    const overlay = svg.append('rect')
        .attr('class', 'brush-overlay')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height);

    //visible brush rectangle
    const brushRect = svg.append('rect')
        .attr('class', 'brush-rect')
        .attr('display', 'none');

    let brushStart = null;

    //start brushing from the main svg group (so the overlay rect doesn't block pointer-events to lines)
    svg.on('mousedown', function(event) {
        brushStart = d3.pointer(event, svg.node());
        //capture current selection snapshot so live dragging doesn't progressively narrow
        svg.node()._brushInitialSelected = svg.selectAll('.line.selected').nodes();
        brushRect.attr('x', brushStart[0]).attr('y', brushStart[1])
            .attr('width', 0).attr('height', 0)
            .classed('visible', true);

        d3.select(window)
            .on('mousemove.brush', mousemove)
            .on('mouseup.brush', mouseup);
    });

    function mousemove(event) {
        if (!brushStart) return;
        const p = d3.pointer(event, svg.node());
        const x0 = Math.min(brushStart[0], p[0]);
        const y0 = Math.min(brushStart[1], p[1]);
        const w = Math.abs(p[0] - brushStart[0]);
        const h = Math.abs(p[1] - brushStart[1]);
        brushRect.attr('x', x0).attr('y', y0).attr('width', w).attr('height', h);

        //perform selection live
        updateSelection({ x: x0, y: y0, width: w, height: h }, false);
    }

    function mouseup(event) {
        if (!brushStart) return;
        const p = d3.pointer(event, svg.node());
        const x0 = Math.min(brushStart[0], p[0]);
        const y0 = Math.min(brushStart[1], p[1]);
        const w = Math.abs(p[0] - brushStart[0]);
        const h = Math.abs(p[1] - brushStart[1]);

        //tiny click clears selection
        if (w < 3 && h < 3) {
            //clear selection
            svg.selectAll('.line').classed('selected', false).classed('faint', false);
            svg.node()._brushInitialSelected = null;
        } else {
            updateSelection({ x: x0, y: y0, width: w, height: h }, true);
            // after finalizing, update the snapshot so subsequent brushes narrow from this selection
            svg.node()._brushInitialSelected = svg.selectAll('.line.selected').nodes();
        }

        brushRect.classed('visible', false);
        brushStart = null;
        d3.select(window).on('mousemove.brush', null).on('mouseup.brush', null);
    }

    //determine candidate lines and set selected/faint classes
    function updateSelection(rect, finalize) {
        const rectBounds = { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height };
        const initial = Array.isArray(svg.node()._brushInitialSelected) && svg.node()._brushInitialSelected.length > 0 ? svg.node()._brushInitialSelected : null;
        const candidates = initial ? initial : svg.selectAll('.line').nodes();

        const newlySelected = new Set();

        candidates.forEach(function(node) {
            const pts = node._pc_points || [];
            if (polylineIntersectsRect(pts, rectBounds)) {
                newlySelected.add(node);
            }
        });

        //determine whether there is any selection at all (either existing or newly selected)
        const hadExisting = (initial && initial.length > 0) || svg.selectAll('.line.selected').nodes().length > 0;

        //lines in newlySelected become selected; others become faint
        svg.selectAll('.line').each(function() {
            const node = this;
            if (newlySelected.has(node)) {
                d3.select(node).classed('selected', true).classed('faint', false);
            } else {
                if (hadExisting || newlySelected.size > 0) {
                    d3.select(node).classed('selected', false).classed('faint', true);
                } else {
                    d3.select(node).classed('selected', false).classed('faint', false);
                }
            }
        });
    }

    //test whether any segment or point of polyline intersects rect
    function polylineIntersectsRect(pts, rect) {
        if (!pts || pts.length === 0) return false;
        //point inside rect
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            if (pointInRect(p[0], p[1], rect)) return true;
        }
        //segment intersection
        for (let i = 0; i < pts.length - 1; i++) {
            if (segmentIntersectsRect(pts[i], pts[i+1], rect)) return true;
        }
        return false;
    }

    function pointInRect(x, y, rect) {
        return x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2;
    }

    function segmentIntersectsRect(a, b, rect) {
        //if either endpoint inside
        if (pointInRect(a[0], a[1], rect) || pointInRect(b[0], b[1], rect)) return true;
        //check intersection with each rect edge
        const edges = [
            [[rect.x1, rect.y1], [rect.x2, rect.y1]],
            [[rect.x2, rect.y1], [rect.x2, rect.y2]],
            [[rect.x2, rect.y2], [rect.x1, rect.y2]],
            [[rect.x1, rect.y2], [rect.x1, rect.y1]]
        ];
        for (let i = 0; i < edges.length; i++) {
            if (segmentsIntersect(a, b, edges[i][0], edges[i][1])) return true;
        }
        return false;
    }

    //standard segment intersection test
    function segmentsIntersect(p1, p2, q1, q2) {
        const orient = (a, b, c) => (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
        const o1 = orient(p1,p2,q1);
        const o2 = orient(p1,p2,q2);
        const o3 = orient(q1,q2,p1);
        const o4 = orient(q1,q2,p2);
        if (o1 === 0 && onSegment(p1, q1, p2)) return true;
        if (o2 === 0 && onSegment(p1, q2, p2)) return true;
        if (o3 === 0 && onSegment(q1, p1, q2)) return true;
        if (o4 === 0 && onSegment(q1, p2, q2)) return true;
        return (o1>0) !== (o2>0) && (o3>0) !== (o4>0);
    }

    function onSegment(a, b, c) {
        return b[0] >= Math.min(a[0], c[0]) && b[0] <= Math.max(a[0], c[0]) &&
               b[1] >= Math.min(a[1], c[1]) && b[1] <= Math.max(a[1], c[1]);
    }

    console.log('Chart rendered with', data.length, 'rows and', dimensions.length, 'axes');
}

//clear selection when clicking outside the chart area
window.addEventListener('click', function(e) {
    const chartEl = document.getElementById('chart');
    if (!chartEl) return;
    if (!chartEl.contains(e.target)) {
        const svgSel = d3.select('#chart svg');
        if (!svgSel.empty()) {
            svgSel.selectAll('.line').classed('selected', false).classed('faint', false);
            if (svgSel.node()) svgSel.node()._brushInitialSelected = null;
        }
    }
});

//redraw chart on window resize (debounced)
let _resizeTimeout = null;
window.addEventListener('resize', function() {
    if (_resizeTimeout) clearTimeout(_resizeTimeout);
    _resizeTimeout = setTimeout(function() {
        // perform non-destructive resize: adjust scales and recompute paths/axes without full redraw
        const chartNode = d3.select('#chart').node();
        if (!chartNode || !chartNode._pc) return;
        const state = chartNode._pc;
        const margin = state.margin;
        const containerWidth = document.getElementById('chart').clientWidth || (state.width + margin.left + margin.right);
        const newWidth = containerWidth - margin.left - margin.right;

        // update stored width
        state.width = newWidth;

        // update outer svg size
        const outer = d3.select('#chart svg');
        if (!outer.empty()) {
            outer.attr('width', newWidth + margin.left + margin.right);
        }

        // update x scale range
        state.x.range([0, newWidth]);

        // update axis group positions
        d3.select('#chart').selectAll('.dimension')
            .attr('transform', d => `translate(${state.x(d)})`);

        // recompute path d and cached points for each line
        d3.select('#chart').selectAll('.line').each(function() {
            const node = this;
            const row = node._pc_row;
            if (!row) return;
            const pts = state.dimensions.map(function(p) {
                const v = state.isNumeric[p] ? +row[p] : String(row[p]);
                return [state.x(p), state.y[p](v)];
            });
            node._pc_points = pts;
            d3.select(node).attr('d', state.line(pts));
        });

        // update overlay size
        d3.select('#chart').selectAll('.brush-overlay')
            .attr('width', newWidth).attr('height', state.height);
    }, 200);
});
