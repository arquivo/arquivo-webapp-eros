function addZero(str){
    return ('0' + str).slice(-2);
}

module.exports = function (date) {
    return [
        date.getFullYear(), 
        addZero(date.getMonth()+1), 
        addZero(date.getDate()), 
        addZero(date.getHours()),
        addZero(date.getMinutes()),
        addZero(date.getSeconds()),
    ].join('')
};