
document.addEventListener("DOMContentLoaded", function() {
    const form = document.querySelector("#simulatorForm");

    if (form) {
        form.addEventListener("submit", function(e) {
            e.preventDefault();

            const formData = new FormData(form);

            fetch("/simulate", {
                method: "POST",
                body: formData
            })
            .then(res => res.json())
            .then(data => {
               
                document.querySelector("#grade").innerText = data.grade;
                document.querySelector("#greenGrade").innerText = data.greenGrade;
                document.querySelector("#energySelf").innerText = data.energySelf;
                document.querySelector("#zebGrade").innerText = data.zebGrade;
                document.querySelector("#propertyTax").innerText = data.propertyTax;
                document.querySelector("#acquireTax").innerText = data.acquireTax;
                document.querySelector("#areaBonus").innerText = data.areaBonus;
                document.querySelector("#resultBox").style.display = "block";
            })
            .catch(err => console.error("에러 발생:", err));
        });
    }
});
