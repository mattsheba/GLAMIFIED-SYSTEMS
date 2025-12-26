window.addEventListener("load", function () {
  fetch("/content/pricing.json")
    .then(response => response.json())
    .then(data => {
      const starter = document.getElementById("starter-price");
      const standard = document.getElementById("standard-price");
      const custom = document.getElementById("custom-price");

      if (starter) starter.textContent = data.starter_price;
      if (standard) standard.textContent = data.standard_price;
      if (custom) custom.textContent = data.custom_price;
    })
    .catch(error => {
      console.error("Pricing load error:", error);
    });
});
