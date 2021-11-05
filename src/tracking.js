module.exports = function (req, res) {

    const splitPath = (req.params.url + (req.params['0'] ?? '')).split('/');
    
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    const requestUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const trackingID = splitPath[0];
    const sessionID = req.session.id;
    const timestamp = splitPath[1];
    const archivedUrl = splitPath.filter((x,i) => {return i>1;}).join('/');

    const logString = `'${ipAddress}'\t"${userAgent}"\t'${requestUrl}'\t'${trackingID}'\t'${sessionID}'\t'${timestamp}'\t'${archivedUrl}'`;
    // console.log(logString); <-- Replace this with logging!

    res.redirect('/wayback/'+timestamp+'/'+archivedUrl);
}