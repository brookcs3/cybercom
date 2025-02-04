(function(){
  // Helper function to try and get the Flot plot instance.
  function getPlot() {
    if (window.plot && typeof window.plot.getData === 'function') {
      return window.plot;
    }
    // Try to retrieve the plot stored in the placeholder's data.
    var p = $("#placeholder").data("plot");
    if (p && typeof p.getData === 'function') {
      return p;
    }
    return null;
  }
  
  // POLLING FUNCTION: Wait until a Flot plot is available.
  function waitForPlot() {
    var plotInstance = getPlot();
    if (plotInstance) {
      console.log("Plot found. Starting forced takeover script.");
      startForcedTakeover();
    } else {
      console.log("Plot not found, waiting...");
      setTimeout(waitForPlot, 500);  // Check again after 500ms.
    }
  }
  
  // FORCED TAKEOVER LOGIC
  function startForcedTakeover() {
    // --- CONFIGURATION PARAMETERS ---
    var baseForcedDelta = 1.5;     // Base forced price change (in data units)
    var updateInterval = 250;      // Interval (in ms) to check for new data.
    
    // currentForcedDelta will be used to adjust the y–value of the artificial point.
    // We expect it to normally be positive (forcing upward movement).
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
    
    // Wrap the global onNewData callback (if it exists) so that real data resets our marker.
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
    
    // Set up an interval that every updateInterval ms checks if new real data has arrived.
    setInterval(function(){
      var series = getLastTradeSeries();
      if (!series) return;
      
      // If no new real data has been added, we add an artificial point.
      if (series.data.length === lastRealDataCount) {
        var lastPoint = series.data[series.data.length - 1];
        
        // --- Check the last 5 data points ---
        if (series.data.length >= 5) {
          // Get the last 5 points.
          var recentPoints = series.data.slice(-5);
          // If the price is not rising over these 5 points (i.e. the last y is not greater than the first y),
          // then force the forced delta to be positive.
          if (recentPoints[recentPoints.length - 1][1] <= recentPoints[0][1]) {
            // "Switch" the forced delta indiscriminately by setting it to the positive base value.
            currentForcedDelta = Math.abs(baseForcedDelta);
            console.log("Price is not rising over the last 5 points. Setting forced delta to", currentForcedDelta);
          }
        }
        
        // Create a new artificial point.
        var newX = lastPoint[0] + updateInterval;
        var newY = lastPoint[1] + currentForcedDelta;
        series.data.push([newX, newY]);
        
        // Optionally trim the series if it grows too long (keeping, say, the last 100 points).
        if (series.data.length > 100) {
          series.data = series.data.slice(-100);
        }
        
        // Force a redraw of the chart.
        var plotInstance = getPlot();
        if (plotInstance) {
          plotInstance.setupGrid();
          plotInstance.draw();
        }
        
        console.log("Artificial forced point added at:", newX, newY);
      } else {
        // New real data arrived—update our marker.
        lastRealDataCount = series.data.length;
      }
    }, updateInterval);
    
    console.log("Forced takeover script activated. The 'Last Trade' series will now force upward movement if the last 5 data points do not show a rising price.");
  }
  
  // Begin searching for the plot.
  waitForPlot();
})();
