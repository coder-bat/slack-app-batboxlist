const {
	App
} = require("@slack/bolt");
require("dotenv").config();
const {
	WebClient,
	LogLevel
} = require("@slack/web-api");
const https = require('https');
const mysql = require('mysql');
// var cron = require('node-cron');
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

// Initializes your app with your bot token and signing secret
const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
});

var connection = mysql.createConnection({
	host: process.env.DBHOST,
	user: process.env.DBUSER,
	password: process.env.DBPASS,
	database: process.env.DBNAME
});


connection.connect(function (err) {
	if (err) console.error(err);
	else console.log("Connected!");
});

(async () => {
	const port = 3000
	// Start your app
	await app.start(process.env.PORT || port);
	console.log(`⚡️ Slack Bolt app is running on port ${port}!`);
})();

app.command("/bat-add", async ({
	command,
	ack,
	say
}) => {
	try {
		await ack();
		if (typeof (command.text) == undefined || command.text == '') {
			web.chat.postMessage({
				"text": "Add task name",
				"channel": command.channel_id,
				"replace_original": "true",
				blocks: [{
					"type": "context",
					"elements": [{
							"type": "plain_text",
							"text": "To add task and assign it to yourself: /add |task= Some task name",
							"emoji": true
						},
						{
							"type": "plain_text",
							"text": "To add task and assign it: /add |task= Some task name |for= @viral",
							"emoji": true
						},
						{
							"type": "plain_text",
							"text": "Make sure to include 'task=' and 'to=' values in given order for above commands",
							"emoji": true
						}
					]
				}],
			});
		} else if (command.text.indexOf('|task=') > -1 && command.text.indexOf('|for=') < 0) {
			var textArr = command.text.split('|task=');
			var textTxt = textArr[textArr.length - 1].trim();
			var sql = `INSERT INTO tasks (taskname, added_by, added_for, added_on, channel_name, status, status_changed_on) 
			VALUES ('${textTxt}', '${command.user_id}', '${command.user_id}', '${Date.now()}', '${command.channel_name}', 'pending', ${Date.now()})`;
			console.log(sql);
			connection.query(sql, function (err, result) {
				if (err) throw err;
				web.chat.postMessage({
					"text": "Task added for you",
					"channel": command.channel ? command.channel.id : command.channel_id,
					'blocks': [{
						"type": "section",
						"text": {
							"type": "plain_text",
							"text": "Task added for you :)",
							"emoji": true
						}
					}],
				});
			});
		} else if (command.text.indexOf('|task=') > -1 && command.text.indexOf('|for=') > -1) {
			var textArr = command.text.split('|task=');
			var commandTxtSplit = textArr[textArr.length - 1];
			console.log(commandTxtSplit);
			// check the command order
			if (commandTxtSplit.indexOf('|for=') < 0) {
				web.chat.postMessage({
					"text": "Please make sure to have correct order. Type /add for help",
					"channel": command.channel ? command.channel.id : command.channel_id,
				});
				return;
			}
			var textTxt = textArr[textArr.length - 1].split('|for=')[0].trim();
			var username = textArr[textArr.length - 1].split('|for=')[1].replace('@', '').trim();

			const useridAsync = async () => {
				const result = await getUserIDByUsername(username);
				return result;
			}
			const userid = await useridAsync();

			if (!userid) {
				web.chat.postMessage({
					"text": "No such user :( Please use mention with @",
					"channel": command.channel ? command.channel.id : command.channel_id,
				});
				return;
			}

			var sql = `INSERT INTO tasks (taskname, added_by, added_for, added_on, channel_name, status, status_changed_on) 
			VALUES ('${textTxt}', '${command.user_id}', '${userid}', '${Date.now()}', '${command.channel_name}', 'pending', ${Date.now()})`;
			connection.query(sql, function (err, result) {
				if (err) throw err;
				web.chat.postMessage({
					"text": "Task added",
					"channel": command.channel ? command.channel.id : command.channel_id,
					'blocks': [{
						"type": "section",
						"text": {
							"type": "plain_text",
							"text": `Task added for ${username} :)`,
							"emoji": true
						}
					}],
				});
			});
		}
	} catch (error) {
		console.log("err")
		console.error(error);
	}
});


app.command("/bat-list", async ({
	command,
	ack,
	say
}) => {
	if (command.text.indexOf('|for=') > -1) {
		try {
			await ack();

			var commandTxtArr = command.text.split('|for=');
			var commandTxt = commandTxtArr[commandTxtArr.length - 1].trim();

			var filter = '';
			var username;

			if (commandTxt.indexOf('|filter=') > -1) {
				filter = commandTxt.split('|filter=')[1].trim();
				username = commandTxt.split('|filter=')[0].trim();
				console.log(filter, username, '1');
			} else if (commandTxt.indexOf('|filter=') < 0 && command.text.indexOf('|filter=') > -1) {
				commandTxtArr = command.text.split('|filter=');
				commandTxt = commandTxtArr[commandTxtArr.length - 1].trim();
				filter = commandTxt.split('|for=')[0].trim();
				username = commandTxt.split('|for=')[1].trim();
				console.log(filter, username, '2');
				// web.chat.postMessage({
				// 	"text": "Follow structure",
				// 	"channel": command.channel_id,
				// 	"replace_original": "true",
				// 	blocks: [{
				// 		"type": "context",
				// 		"elements": [{
				// 				"type": "plain_text",
				// 				"text": "To list all your tasks, type /list",
				// 				"emoji": true
				// 			},
				// 			{
				// 				"type": "plain_text",
				// 				"text": "To list someone else's tasks, type /list |for= @viral",
				// 				"emoji": true
				// 			},
				// 			{
				// 				"type": "plain_text",
				// 				"text": "To filter the tasks, type /list |filter= pending|done |for= @viral",
				// 				"emoji": true
				// 			}
				// 		]
				// 	}],
				// });
			} else {
				var commandTxtArr = command.text.split('|for=');
				var commandTxt = commandTxtArr[commandTxtArr.length - 1].trim();
				username = commandTxt;
				console.log(username, '3');
			}

			username = username.replace('@', '');
			const useridAsync = async () => {
				const result = await getUserIDByUsername(username);
				return result;
			}
			const userid = await useridAsync();

			if (!userid) {
				web.chat.postMessage({
					"text": "No such user :( Please use mention with @",
					"channel": command.channel ? command.channel.id : command.channel_id,
				});
				return;
			}

			var tasksList = [];
			var doneTasks = [];
			var sql = `SELECT * FROM tasks WHERE  
			added_for="${userid}"`;
			if (filter != '' && (filter == 'pending' || filter == 'done')) {
				sql = sql + ` AND status="${filter}"`;
			}
			connection.query(sql, function (err, result) {
				if (err) throw err;
				result.forEach(element => {
					tasksList.push({
						"value": `${element.taskid}`,
						"text": {
							"type": element.status == "done" ? "mrkdwn" : "plain_text",
							"text": element.status == "done" ? `~${element.taskname}~` : `${element.taskname}`,
						}
					});
				});
				var perChunk = 10;

				var tasksListInChunk = tasksList.reduce((resultArray, item, index) => {
					const chunkIndex = Math.floor(index / perChunk)

					if (!resultArray[chunkIndex]) {
						resultArray[chunkIndex] = [] // start a new chunk
					}

					resultArray[chunkIndex].push(item)

					return resultArray
				}, []);

				tasksListInChunk.forEach((item, index) => {
					doneTasks[index] = item.filter(task => task.text.type === "mrkdwn");
				})
				var blocks = [];

				blocks.push({
					"type": "section",
					"block_id": `task_list_header`,
					"text": {
						"type": "plain_text",
						"text": `List of all ${filter} tasks for <@${username}>`
					},
				});


				tasksListInChunk.forEach(function (item, index) {
					if (doneTasks[index] && doneTasks[index].length > 0) {
						console.log(doneTasks[index]);
						blocks.push({
							"type": "section",
							"block_id": `task_list_${index}_${userid}`,
							"text": {
								"type": "plain_text",
								"text": ' '
							},
							"accessory": {
								"type": "checkboxes",
								"action_id": "task_status_update",
								"initial_options": doneTasks[index],
								"options": tasksListInChunk[index],
							}
						});
					} else {
						blocks.push({
							"type": "section",
							"block_id": `task_list_${index}_${userid}`,
							"text": {
								"type": "plain_text",
								"text": ' '
							},
							"accessory": {
								"type": "checkboxes",
								"action_id": "task_status_update",
								"options": tasksListInChunk[index],
							}
						});
					}
				});

				web.chat.postMessage({
					"text": "List of all tasks",
					"channel": command.channel ? command.channel.id : command.channel_id,
					"text": "List of all tasks",
					blocks,
				});
			});
		} catch (error) {
			console.log("err")
			console.error(error);
		}
	} else {
		try {
			await ack();
			var userid = command.user_id;
			var tasksList = [];
			var doneTasks = [];
			var filter = '';
			if (command.text.indexOf('|filter=') > -1) {
				var commandTxtArr = command.text.split('|filter=');
				filter = commandTxtArr[commandTxtArr.length - 1].trim();
			}
			var sql = `SELECT * FROM tasks WHERE  
		added_for="${userid}"`;
			if (filter.length > 0) {
				sql = sql + ` AND status="${filter}"`;
			}
			connection.query(sql, function (err, result) {
				if (err) throw err;
				result.forEach(element => {
					tasksList.push({
						"value": `${element.taskid}`,
						"text": {
							"type": element.status == "done" ? "mrkdwn" : "plain_text",
							"text": element.status == "done" ? `~${element.taskname}~` : `${element.taskname}`,
						},
					});
				});
				var perChunk = 10;

				var tasksListInChunk = tasksList.reduce((resultArray, item, index) => {
					const chunkIndex = Math.floor(index / perChunk)

					if (!resultArray[chunkIndex]) {
						resultArray[chunkIndex] = [] // start a new chunk
					}

					resultArray[chunkIndex].push(item)

					return resultArray
				}, []);

				tasksListInChunk.forEach((item, index) => {
					doneTasks[index] = item.filter(task => task.text.type === "mrkdwn");
				})
				var blocks = [];

				blocks.push({
					"type": "section",
					"block_id": `task_list_header`,
					"text": {
						"type": "plain_text",
						"text": `List of all ${filter} tasks for <@${command.user_name}>`
					},
				});


				tasksListInChunk.forEach(function (item, index) {
					if (doneTasks[index] && doneTasks[index].length > 0) {
						blocks.push({
							"type": "section",
							"block_id": `task_list_${index}_${userid}`,
							"text": {
								"type": "plain_text",
								"text": ' '
							},
							"accessory": {
								"type": "checkboxes",
								"action_id": "task_status_update",
								"initial_options": doneTasks[index],
								"options": tasksListInChunk[index],
							}
						});
					} else {
						blocks.push({
							"type": "section",
							"block_id": `task_list_${index}_${userid}`,
							"text": {
								"type": "plain_text",
								"text": ' '
							},
							"accessory": {
								"type": "checkboxes",
								"action_id": "task_status_update",
								"options": tasksListInChunk[index],
							}
						});
					}
				});

				web.chat.postMessage({
					"text": "List of all tasks",
					"channel": command.channel ? command.channel.id : command.channel_id,
					"text": "List of all tasks",
					blocks,
				});
			});
		} catch (error) {
			console.log("err")
			console.error(error);
		}
	}
});

app.command("/batbox-help", async ({
	command,
	ack,
	say
}) => {
	try {
		await ack();
		web.chat.postMessage({
			"text": "Follow structure",
			"channel": command.channel_id,
			"replace_original": "true",
			blocks: [{
					"type": "header",
					"text": {
						"type": "plain_text",
						"text": "Need some Bathelp?",
						"emoji": true
					}
				},
				{
					"type": "context",
					"elements": [{
							"type": "plain_text",
							"text": "To add task and assign it to yourself: /add |task= Some task name",
							"emoji": true
						},
						{
							"type": "plain_text",
							"text": "To add task and assign it: /add |task= Some task name |for= @viral",
							"emoji": true
						},
						{
							"type": "plain_text",
							"text": "Make sure to include 'task=' and 'to=' values in given order for above commands",
							"emoji": true
						},
						{
							"type": "plain_text",
							"text": "To list all your tasks, type /list. Can be used as /list |filter= done or /list |filter= pending",
							"emoji": true
						},
						{
							"type": "plain_text",
							"text": "To list someone else's tasks, type /list |for= @viral",
							"emoji": true
						},
						{
							"type": "plain_text",
							"text": "To filter the tasks, type /list |filter= pending|done |for= @viral",
							"emoji": true
						}
					]
				}
			],
		});

	} catch (error) {
		console.log("err")
		console.error(error);
	}
});

app.action('task_status_update', async ({
	body,
	ack,
	say
}) => {
	var obj = body;
	var cbs = getSelectedCB(body);
	var allCbsInBlock = body.message.blocks.filter(obj => {
		return obj.block_id === body.actions[0].block_id
	})[0].accessory.options;
	await ack();
	var userid = body.user.id;
	if ((body.actions[0].block_id.match(/_/g) || []).length > 0) {
		var tempArr = body.actions[0].block_id.split('_');
		userid = tempArr[tempArr.length - 1];
	}
	console.log(userid);

	if (cbs && allCbsInBlock) {
		var doneTasksIDs = [];
		var pendingTaskIDs = [];
		allCbsInBlock.forEach((item, index) => {
			if (cbs.some(cb => cb.value === item.value)) {
				doneTasksIDs.push(`${item.value}`);
			} else {
				pendingTaskIDs.push(`${item.value}`);
			}
		});

		if (pendingTaskIDs.length == 0) {
			pendingTaskIDs = ['0'];
		}

		if (doneTasksIDs.length == 0) {
			doneTasksIDs = ['0'];
		}

		var sql = `UPDATE tasks SET status='done',status_changed_on=${Date.now()}  WHERE taskid IN (${doneTasksIDs.join(',')})`
		connection.query(sql, function (err, result) {
			if (err) throw err;
			var sql2 = `UPDATE tasks SET status='pending',status_changed_on=${Date.now()} WHERE taskid IN (${pendingTaskIDs.join(',')})`
			connection.query(sql2, function (err, result2) {
				if (err) throw err;
				var username = body.user.username;
				var tasksList = [];
				var doneTasks = [];
				var sql = `SELECT * FROM tasks WHERE  
				added_for="${userid}"`;
				connection.query(sql, function (err, result) {
					if (err) throw err;
					result.forEach(element => {
						tasksList.push({
							"value": `${element.taskid}`,
							"text": {
								"type": element.status == "done" ? "mrkdwn" : "plain_text",
								"text": element.status == "done" ? `~${element.taskname}~` : `${element.taskname}`,
							}
						});
					});
					var perChunk = 10;

					var tasksListInChunk = tasksList.reduce((resultArray, item, index) => {
						const chunkIndex = Math.floor(index / perChunk)

						if (!resultArray[chunkIndex]) {
							resultArray[chunkIndex] = [] // start a new chunk
						}

						resultArray[chunkIndex].push(item)

						return resultArray
					}, []);

					tasksListInChunk.forEach((item, index) => {
						doneTasks[index] = item.filter(task => task.text.type === "mrkdwn");
					})
					var blocks = [];

					blocks.push({
						"type": "section",
						"block_id": `task_list_header`,
						"text": {
							"type": "mrkdwn",
							"text": `List of all tasks for <@${userid}>`
						},
					});


					tasksListInChunk.forEach(function (item, index) {
						if (doneTasks[index] && doneTasks[index].length > 0) {
							blocks.push({
								"type": "section",
								"block_id": `task_list_${index}_${userid}`,
								"text": {
									"type": "plain_text",
									"text": ' '
								},
								"accessory": {
									"type": "checkboxes",
									"action_id": "task_status_update",
									"initial_options": doneTasks[index],
									"options": tasksListInChunk[index],
								}
							});
						} else {
							blocks.push({
								"type": "section",
								"block_id": `task_list_${index}_${userid}`,
								"text": {
									"type": "plain_text",
									"text": ' '
								},
								"accessory": {
									"type": "checkboxes",
									"action_id": "task_status_update",
									"options": tasksListInChunk[index],
								}
							});
						}
					});

					web.chat.update({
						"text": "List of all tasks",
						"ts": body.message.ts,
						"channel": body.channel.id,
						blocks,
					});
				});
			});

		});
	}
});

function getValueFromState(body, block_id, type = 'default', multiple_blocks = false) {
	if (type == 'user_arr') {
		var obj = body.state.values[block_id];
		return obj[Object.keys(obj)[0]].selected_user;
	} else if (type == 'checkboxes') {
		var obj = body.state.values;
		var selectedOptions = [];
		for (const single_block in obj) {
			var temp = obj[single_block].task_status_update.selected_options;
			selectedOptions = selectedOptions.concat(temp);
		}
		return selectedOptions;
	} else {
		var obj = body.state.values[block_id];
		if (obj[Object.keys(obj)[0]]) {
			return obj[Object.keys(obj)[0]].value;
		} else {
			var arr = body.message.blocks;
			var val = arr.filter(item => item.block_id === 'task_name').map(item => item.element.initial_value);
			return val[0];
		}
	}
}

function getSelectedCB(body) {
	if (body.actions.length > 0) {
		var selectedOptions = [];
		return body.actions[0].selected_options;
	};
	return null;
}

async function getUserIDByUsername(username) {
	try {
		var data = await web.users.list();
		var userInfo = data.members.filter(member => member.name == username);
		var userID = userInfo[0].id;
		return userID;
	} catch (error) {
		console.log("error" + error);
	} finally {
		console.log('done');
	}
}

// const task = cron.schedule('* * * * *', () => {
// 	console.log('running a task every minute');
// }, {
// 	scheduled: true,
// });

// app.action('save_task_name', async ({
// 	body,
// 	ack,
// 	say
// }) => {
// 	await ack();
// 	var taskname = getValueFromState(body, 'task_name');
// 	web.chat.update({
// 		"text": "Assign task",
// 		'response_type': 'ephemeral',
// 		'ts': body.container.message_ts,
// 		'channel': body.container.channel_id,
// 		'replace_original': true,
// 		blocks: [{
// 				"type": "input",
// 				"block_id": "task_name",
// 				"label": {
// 					"type": "plain_text",
// 					"text": "Task name"
// 				},
// 				"element": {
// 					"type": "plain_text_input",
// 					"action_id": "plain_input",
// 					"initial_value": `${taskname}`
// 				}
// 			},
// 			{
// 				"type": "input",
// 				"block_id": 'user_list',
// 				"element": {
// 					"type": "users_select"
// 				},
// 				"label": {
// 					"type": "plain_text",
// 					"text": "Assign task to",
// 					"emoji": true
// 				}
// 			},
// 			{
// 				"type": "actions",
// 				"elements": [{
// 					"type": "button",
// 					action_id: 'task_ass',
// 					"text": {
// 						"type": "plain_text",
// 						"emoji": true,
// 						"text": "Save"
// 					},
// 					"style": "primary",
// 					"value": "assign_task"
// 				}]
// 			}
// 		]
// 	})
// });

// app.action('task_ass', async ({
// 	body,
// 	ack,
// 	say
// }) => {
// 	var obj = body.state.values;
// 	var taskname = getValueFromState(body, 'task_name');
// 	var assigned_user = getValueFromState(body, 'user_list', 'user_arr');
// 	await ack();

// 	if (!assigned_user) {
// 		say({
// 			"text": "Please select user",
// 			"replace_original": "false",
// 		});
// 	} else {
// 		var sql = `INSERT INTO tasks (taskname, added_by, added_for, added_on, channel_name, status, status_changed_on) 
// 	VALUES ('${taskname}', '${body.user.id}', '${assigned_user}', '${Date.now()}', '${body.channel.name}', 'pending', ${Date.now()})`;
// 		console.log(sql);
// 		connection.query(sql, function (err, result) {
// 			if (err) throw err;
// 			web.chat.update({
// 				"text": "Task added",
// 				'response_type': 'ephemeral',
// 				'ts': body.container.message_ts,
// 				'channel': body.container.channel_id,
// 				'replace_original': true,
// 				'delete_original': true,
// 				'blocks': [{
// 					"type": "section",
// 					"text": {
// 						"type": "plain_text",
// 						"text": "Task added :)",
// 						"emoji": true
// 					}
// 				}]
// 			});
// 		});
// 	}
// });