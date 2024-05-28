const bgContainer = document.getElementById("bg-container");
const balls = document.getElementsByClassName("bg-ball");
const perspectiveFactor = 0.5;

const pos = [[22, 61], [52, 100], [75, 32]];
const scales = [0.70, 0.55, 0.9];
const T = [8500, 14600, 12000]
const A = [15, 30, 20]
const phi = [0, 3, 1.5]

for (let i = 0; i < 3; i++) {
    balls[i].style.left = `${pos[i][0]}vw`;
    balls[i].style.top = `${pos[i][1]}vh`;
}
function animation(time) {
    for (let i = 0; i < 3; i++) {
        const x = A[i] * Math.cos(2 * Math.PI * time / T[i] + phi[i]);
        const y = A[i] * Math.sin(2 * Math.PI * time / T[i] + phi[i]);
        balls[i].style.transform = `translateX(calc(${x}px - 50%)) translateY(calc(${y}px - 50%)) scale(${scales[i]})`
    }
    requestAnimationFrame(animation);
}
requestAnimationFrame(animation)

window.onscroll = () => {
    bgContainer.style.transform = `translateY(-${perspectiveFactor * window.scrollY}px)`;
}