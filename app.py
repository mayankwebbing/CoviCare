from flask import Flask, redirect, render_template, request, url_for
from os import environ
import requests
import json
import datetime

app = Flask(__name__)
app.debug = True

@app.route('/')
def index():
    r = requests.get('https://api.rootnet.in/covid19-in/stats/latest', verify=False)
    data = r.json()['data']
    a = requests.get('https://api.covid19india.org/data.json', verify=False)
    today = a.json()['cases_time_series'][-1]
    yesterday = a.json()['cases_time_series'][-2]
    today['active'] = int(today['dailyconfirmed'])-(int(today['dailydeceased'])+ int(today['dailyrecovered']))
    yesterday['active'] = int(yesterday['dailyconfirmed'])-(int(yesterday['dailydeceased'])+ int(today['dailyrecovered']))
    def calcIncrement(key):
        return "{:.2f}".format(((int(today[key]) - int(yesterday[key]))/int(yesterday[key]))*100)

    increment = {}
    increment['total'] = calcIncrement('dailyconfirmed')
    increment['recovered'] = calcIncrement('dailyrecovered')
    increment['active'] = calcIncrement('active')   
    increment['deceased'] = calcIncrement('dailydeceased')

    # return today
    return render_template('hello.html',today=today, data=data['summary'], increment=increment,regional = data['regional'])

if __name__ == '__main__':
    app.run(host ='localhost', port = 5000, debug = True)