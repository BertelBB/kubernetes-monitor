#!/usr/bin/python3

import sys
import os
import requests
import json

def notifySlack(operator_version, upstream_community):
    circle_build_url = os.getenv('CIRCLE_BUILD_URL')
    url = os.getenv('SLACK_WEBHOOK')

    data = {
      'attachments':
      [
        {
          'color': '#7CD197',
          'fallback': 'Build Notification: ' + circle_build_url,
          'title': 'Snyk Operator Pushed to GitHub repo snyk/community-operators',
          'text': 'Branch *snyk/snyk-operator-v' + operator_version + '* is ready for publishing to the ' + upstream_community + '.\n' +
            'https://github.com/operator-framework/community-operators/compare/master...snyk:snyk/snyk-operator-v' + operator_version + '-' + upstream_community
        }
      ]
    }

    requests.post(url, data=json.dumps(data))

if __name__ == '__main__':
    operator_version = sys.argv[1]
    upstream_community = sys.argv[2]
    notifySlack(operator_version, upstream_community)
