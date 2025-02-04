(function(){
  // Helper function to retrieve the Flot plot instance.
  function getPlot() {
    if (window.plot && typeof window.plot.getData === 'function') {
      return window.plot;
    }
    // Alternatively, try to retrieve the plot stored in the placeholder's data.
    var p = $("#placeholder").data("plot");
    if (p && typeof p.getData === 'function') {
      return p;
    }
    return null;
  }
  
  // Poll until a Flot plot is available.
  function waitForPlot() {
    var plotInstance = getPlot();
    if (plotInstance) {
      console.log("Plot found. Starting forced takeover script.");
      startForcedTakeover();
    } else {
      console.log("Plot not found, waiting...");
      setTimeout(waitForPlot, 500);
    }
  }
  
  // Forced takeover logic.
  function startForcedTakeover() {
    // --- CONFIGURATION PARAMETERS ---
    var baseForcedDelta = 1.5;     // The base magnitude of the forced delta (in data units)
    var updateInterval = 250;      // Update interval in milliseconds.
    
    // currentForcedDelta is our working delta value.
    // (Starts positive.)
    var currentForcedDelta = baseForcedDelta;
    
    // Retrieve the "Last Trade" series from the plot.
    function getLastTradeSeries() {
      var plotInstance = getPlot();
      if (!plotInstance) return null;
      var data = plotInstance.getData();
      if (!data || !Array.isArray(data)) return null;
      return data.find(function(s) {
        return s.label && s.label.indexOf("Last Trade") !== -1;
      });
    }
    
    var lastTradeSeries = getLastTradeSeries();
    if (!lastTradeSeries) {
      console.error("No 'Last Trade' series found.");
      return;
    }
    
    // Use the series length as a marker for new real data.
    var lastRealDataCount = lastTradeSeries.data.length;
    
    // Optionally wrap the global onNewData callback so that real data updates our marker.
    var origOnNewData = window.onNewData;
    window.onNewData = function(newPoint) {
      var series = getLastTradeSeries();
      if (series) {
        lastRealDataCount = series.data.length;
      }
      if (typeof origOnNewData === "function") {
        origOnNewData(newPoint);
      }
    };
    
    // Set up an interval to check for new data and inject an artificial point if needed.
    setInterval(function(){
      var series = getLastTradeSeries();
      if (!series) return;
      
      // Only inject an artificial point if no new real data was added.
      if (series.data.length === lastRealDataCount) {
        var lastPoint = series.data[series.data.length - 1];
        
        // If we have at least 5 data points, examine the last 5.
        if (series.data.length >= 5) {
          var recentPoints = series.data.slice(-5);
          var firstY = recentPoints[0][1];
          var lastY = recentPoints[recentPoints.length - 1][1];
          
          if (lastY > firstY) {
            // The last 5 points show an upward movement.
            currentForcedDelta = Math.abs(baseForcedDelta);
            console.log("Last 5 points going up. Forced delta set to positive:", currentForcedDelta);
          } else {
            // The last 5 points are not going up (flat or down) — flip the forced delta.
            currentForcedDelta = -currentForcedDelta;
            console.log("Last 5 points not going up. Flipping forced delta to:", currentForcedDelta);
          }
        }
        
        // Create a new artificial point.
        var newX = lastPoint[0] + updateInterval;  // Advance x by the update interval.
        var newY = lastPoint[1] + currentForcedDelta;
        series.data.push([newX, newY]);
        
        // Optionally, trim the series if it grows too long (e.g., keep only the last 100 points).
        if (series.data.length > 100) {
          series.data = series.data.slice(-100);
        }
        
        // Redraw the chart.
        var plotInstance = getPlot();
        if (plotInstance) {
          plotInstance.setupGrid();
          plotInstance.draw();
        }
        
        console.log("Artificial forced point added at:", newX, newY);
      } else {
        // New real data has arrived—update our marker.
        lastRealDataCount = series.data.length;
      }
    }, updateInterval);
    
    console.log("Forced takeover script activated. If the last 5 points are not rising, the forced delta will be switched.");
  }
  
  // Start searching for the plot.
  waitForPlot();
})();
