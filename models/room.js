"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Room extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

    static associate(models) {
      // define association here
      this.hasMany(models.Move, { foreignKey: "Room_id" });
    }
  }
  Room.init(
    {
      room_code: {
        type: DataTypes.STRING,
        unique: {
          args: true,
          msg: "it must be unique",
        },
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: "waiting",
      },
    },
    {
      sequelize,
      modelName: "Room",
    }
  );
  return Room;
};
