var CT = require('./modules/country-list');
var AM = require('./modules/account-manager');
var EM = require('./modules/email-dispatcher');
var MongoClient = require('mongodb').MongoClient;
var dbUrl = "mongodb://localhost:27017/";
//const date = require('date-and-time');

module.exports = function(app) {
	app.get('/', function (req, res) {
		if (req.session.user == null || req.cookies.login == undefined){
			console.log("user has not login");
			res.redirect('/loginpage');
		}else{
			console.log("user login already");
			res.sendFile( __dirname + "/Page/" + "mainpage.html" );
		}
	});
	
	app.get('/aboutus', function (req, res) {
			res.sendFile( __dirname + "/Page/" + "aboutus.html" );
	});

	app.post('/addorder',function(req, res){
		
		console.log("user click item to add");
		//set order item date and time
		var now = new Date();
		var product=req.body['Product'];
		var orderStatus=req.body['OrderStatus'];
		var cookieLogin=req.body["login"];
		// use cookie to find back username for add order list
		MongoClient.connect(dbUrl,{useNewUrlParser: true, useUnifiedTopology: true}, function(err, db) {
			if (err) throw err;
			var dbo = db.db("20201027v2");
			var myquery = {"cookie":cookieLogin};
			dbo.collection("accounts").findOne(myquery,function (err, result) {
				if (err) throw err;
				console.log("use cookie find the user ID");
				console.log(result.user);
				var username=result.user;
				var finalcount;
                var myobj = {"Name" : username,"Date" : now.toString(),"Product" : product, "OrderStatus" : orderStatus };
                // insert the order list from user click
				dbo.collection(username).insertOne(myobj, function(err, res) {
					if (err) throw err;
					console.log("info inserted");
					db.close();			
				});
				res.end('{"result":"sucess"}');							
			});
		});
	});	

	app.get('/orderlist', function (req, res) {
		if (req.session.user == null || req.cookies.login == undefined){
			res.redirect('/loginpage');
		}else{
			res.sendFile( __dirname + "/Page/" + "OrderList.html" );
		}
	});

	app.post('/orderlist',function(req, res){
		
		//use cookie find back username
		var cookieLogin=req.body["login"];
		MongoClient.connect(dbUrl,{useNewUrlParser: true, useUnifiedTopology: true}, async function (err, db) {
            if (err) throw err;
            var dbo = db.db("20201027v2");
			var myquery = {"cookie":cookieLogin};
			dbo.collection("accounts").findOne(myquery,function (err, result) {
				if (err) throw err;
				console.log(result.user);
				var username=result.user;
				var finalcount;            
                dbo.collection(username).find(username).toArray(function (err, result) {
					if (err) throw err;
					console.log(result);
					var a=JSON.stringify(result);
					res.end(a);
					db.close();
				});							
			});
		});
	});
				
/*
	login & logout
*/
	app.get('/loginpage', function(req, res){
	// check if the user has an auto login key saved in a cookie //
		if (req.cookies.login == undefined){
			res.render('login', { title: 'Hello - Please Login To Your Account' });
		}	else{
	// attempt automatic login //
			AM.validateLoginKey(req.cookies.login, req.ip, function(e, o){
				if (o){
					AM.autoLogin(o.user, o.pass, function(o){
						req.session.user = o;
						res.redirect('/');
						//res.sendFile( __dirname + "/Page/" + "mainpage.html" );
					});
				}	else{
					res.render('login', { title: 'Hello - Please Login To Your Account' });
				}
			});
		}
	});
	
	app.post('/loginpage', function(req, res){
		AM.manualLogin(req.body['user'], req.body['pass'], function(e, o){
			if (!o){
				res.status(400).send(e);
			}	else{
				req.session.user = o;
				if (req.body['remember-me'] == 'false'){
					res.status(200).send(o);
				}	else{
					AM.generateLoginKey(o.user, req.ip, function(key){
						res.cookie('login', key, { maxAge: 900000 });
						res.status(200).send(o);
					});
				}
			}
		});
	});

	app.post('/logout', function(req, res){
		res.clearCookie('login');
		req.session.destroy(function(e){ res.status(200).send('ok'); });
	});
	
/*
	control panel
*/
	
	app.get('/home', function(req, res) {
		if (req.session.user == null){
			res.redirect('/loginpage');
		}	else{
			res.redirect('/');
			}
		});	

	app.get('/myaccount', function(req, res) {
		if (req.session.user == null){
			res.redirect('/loginpage');
		}	else{
			res.render('home', {
				title : 'Control Panel',
				countries : CT,
				udata : req.session.user
			});
		}
	});	
	
	
	app.post('/myaccount', function(req, res){
		if (req.session.user == null){
			res.redirect('/loginpage');
		}	else{
			AM.updateAccount({
				id		: req.session.user._id,
				name	: req.body['name'],
				email	: req.body['email'],
				pass	: req.body['pass'],
				country	: req.body['country']
			}, function(e, o){
				if (e){
					res.status(400).send('error-updating-account');
				}	else{
					req.session.user = o.value;
					res.status(200).send('ok');
				}
			});
		}
	});

/*
	new accounts
*/

	app.get('/signup', function(req, res) {
		res.render('signup', {  title: 'Signup', countries : CT });
	});
	
	app.post('/signup', function(req, res){
		AM.addNewAccount({
			name 	: req.body['name'],
			email 	: req.body['email'],
			user 	: req.body['user'],
			pass	: req.body['pass'],
			country : req.body['country']
		}, function(e){
			if (e){
				res.status(400).send(e);
			}	else{
				res.status(200).send('ok');
			}
		});
	});

/*
	password reset
*/

	app.post('/lost-password', function(req, res){
		let email = req.body['email'];
		AM.generatePasswordKey(email, req.ip, function(e, account){
			if (e){
				res.status(400).send(e);
			}	else{
				EM.dispatchResetPasswordLink(account, function(e, m){
			// TODO this callback takes a moment to return, add a loader to give user feedback //
					if (!e){
						res.status(200).send('ok');
					}	else{
						for (k in e) console.log('ERROR : ', k, e[k]);
						res.status(400).send('unable to dispatch password reset');
					}
				});
			}
		});
	});

	app.get('/reset-password', function(req, res) {
		AM.validatePasswordKey(req.query['key'], req.ip, function(e, o){
			if (e || o == null){
				res.redirect('/loginpage');
			} else{
				req.session.passKey = req.query['key'];
				res.render('reset', { title : 'Reset Password' });
			}
		})
	});
	
	app.post('/reset-password', function(req, res) {
		let newPass = req.body['pass'];
		let passKey = req.session.passKey;
	// destory the session immediately after retrieving the stored passkey //
		req.session.destroy();
		AM.updatePassword(passKey, newPass, function(e, o){
			if (o){
				res.status(200).send('ok');
			}	else{
				res.status(400).send('unable to update password');
			}
		})
	});
	
/*
	view, delete & reset accounts
*/

	app.post('/delete', function(req, res){
		AM.deleteAccount(req.session.user._id, function(e, obj){
			if (!e){
				res.clearCookie('login');
				req.session.destroy(function(e){ res.status(200).send('ok'); });
			}	else{
				res.status(400).send('record not found');
			}
		});
	});

	app.get('*', function(req, res) { res.render('404', { title: 'Page Not Found'}); });

};
