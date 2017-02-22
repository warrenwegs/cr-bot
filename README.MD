# Run cr-bot
You need to have `BOT_API_KEY` environment variable set. You can do that separately
```EXPORT BOT_API_KEY=your_api_key```
or when starting the app: 
```BOT_API_KEY=your_api_key npm start```

# Easiest way to set CrBot as a service is to use forever and forever-service
`npm install -g forever` [forever](https://github.com/foreverjs/forever)
`npm install -g forever-service` [forever-service](https://github.com/zapty/forever-service)

# Usage Example
`sudo forever-service install cr-bot --script bot.js -e "BOT_API_KEY=your_api_key BOT_DB_PATH=full_path_to_sql BOT_NAME=your_bot_name" -f " -c 'node --harmony_array_includes'"`

# Start service on boot-up
`sudo update-rc.d cr-bot defaults`