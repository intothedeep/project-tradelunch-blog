module.exports = function (req: any, res: any, next: any) {
    if (!req.isAuthenticated()) {
        res.redirect('/accounts/login');
    } else {
        return next();
    }
};
