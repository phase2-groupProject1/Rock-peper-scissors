"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Move extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Move.belongsTo(models.User, { foreignKey: "User_id" });
      models.User.hasMany(Move, { foreignKey: "User_id" });

      // Move belongs to a Room
      Move.belongsTo(models.Room, { foreignKey: "Room_id" });
      models.Room.hasMany(Move, { foreignKey: "Room_id" });
    }
  }
  Move.init(
    {
      Room_id: DataTypes.INTEGER,
      User_id: DataTypes.INTEGER,
      choice: DataTypes.STRING,
      result: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Move",
    }
  );
  return Move;
};
