import json
import requests

r = requests.get('https://api.rootnet.in/covid19-in/stats/latest')
data = r.json()['data']
a = requests.get('https://api.covid19india.org/data.json')
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

print("total",today,"\n")
print("summary",data['summary'],"\n")
print("increment",increment,"\n")
print("regional",data['regional'],"\n")
