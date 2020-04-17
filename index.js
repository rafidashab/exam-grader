var mysql = require('mysql');
var express = require('express');
var session = require('express-session');
var path = require('path');
var md5 = require('md5');
const fs = require('fs')
const csv = require('csv-parser')
const csv_gen = require('csv')

//multer object creation
var multer  = require('multer')
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
  }
})

var upload = multer({ storage: storage })

var connection = mysql.createConnection({
    host     : '35.227.146.173',
    database : 'cmpt470',
	user     : 'readonlyuser',
	password : 'readonly'
});

const app = express();
app.set('view engine', 'ejs')

app.use(session({
	secret: 'cmpt470',
	resave: true,
	saveUninitialized: true
}));
app.use(express.urlencoded({extended : true}));
app.use(express.json());

function checkLoggedIn(request, response, next) {
    if (request.session.loggedin) {
        next();
	} else {
        response.redirect('/');
        return;
	}
}

app.get('/', function(request, response) {
    if (request.session.loggedin) {
        response.redirect('home');
	} else {
		response.sendFile(path.join(__dirname + '/login.html'));
	}
});


app.post('/auth', function(request, response) {
	var username = request.body.username;
	var password = request.body.password;
	if (username && password) {
        hashed_password = md5(password);
		connection.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, hashed_password], function(error, results, fields) {
			if (results.length > 0) {
				request.session.loggedin = true;
				request.session.username = username;
				response.redirect('/home');
			} else {
				response.redirect('/');
			}			
			response.end();
		});
	} else {
		response.send('Please enter Username and Password!');
		response.end();
	}
});

app.get('/home', checkLoggedIn, function(request, response) {
    response.render('pages/home',  {title: 'home', message: 'Hello ' + request.session.username + '!!'});
});

app.get('/logout', checkLoggedIn, function(req, res, next) {
    if (req.session) {
      // delete session object
      req.session.destroy(function(err) {
        if(err) {
          return next(err);
        } else {
          return res.redirect('/');
        }
      });
    }
});

app.post('/upload', checkLoggedIn, upload.single('upload_csv'), (req, res) => {
    if (req.file) {

        let results = [];
 
        fs.createReadStream('public/uploads/'+ req.file.filename)
        .pipe(csv({
            mapHeaders: ({ header, index }) => index,
            mapValues: ({header,index,value}) => index != 0 ? parseFloat(parseFloat(value).toFixed(2)) : value
        }))
        .on('data', (data) => 
            {
                results.push(data)
            })
        .on('end', () => {
            total = results.find(r => r[0] == 'total');
            total_marks = total[1] + total[2] + total[3];
            console.log(total_marks)
            if (total_marks == 100.00) {
                final_marks = []
                results.map(r => {
                    if (r[0] != 'total') {
                    mark = ( (total[1]/100)  * r[1] ) + ( (total[2]/100) * r[2]) + ( (total[3]/100)  *  r[3] );
                    final_marks.push(mark.toFixed(2)); 
                    }
                })
                //console.log(final_marks);
                results = results.filter(r => r[0] !== 'total');
                res.render('pages/histogram', {title: "Histogram", message: "File upload successful", marks: final_marks, result: results})
            }
            else {
                res.send('Upload another file with appropirate total column')
            }
            
        });
       

    } else {
        res.send('File Upload Failed');
    }
});

app.post('/print', (req, res) => {
    console.log(req.body)
    const {range, results, marks} = req.body;

    total = 100
    grades = [ 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
    results.map((row,index) => {
        mark = marks[index];
        console.log(mark);
        let total = 100;
        low_bound = [];
        for (var i = 0; i < range.length; i++) {
            val = range[i];
            if (total-val >= 0) {
                low_bound[i] = total - val;
            } else {
                low_bound[i] = 0
            }
            if (mark > low_bound[i] && mark <=total) { 
                grade = grades[i] 
                break;
            }
            else {
                grade = 'Incomplete distribution'
                total = low_bound[i];
            }
        }
        row.push(grade);
    })

    res.render('pages/results', {title: 'Result', message: 'Calculated grades',  result: results})

})

port = 12345;
app.listen(port, () => console.log(`Exam app listening at http://localhost:${port}`))
